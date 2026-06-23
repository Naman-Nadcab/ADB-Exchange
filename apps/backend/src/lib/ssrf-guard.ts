/**
 * SSRF egress guard (H-7).
 *
 * Validates that an outbound URL is safe to fetch from the server:
 *  - protocol allowlist (default https/http)
 *  - optional exact-host allowlist (from caller/env)
 *  - blocks localhost / *.local / *.internal names
 *  - resolves DNS and rejects if the host (or ANY resolved A/AAAA record) is a private,
 *    loopback, link-local, CGNAT, or otherwise non-public address.
 *
 * NOTE: This mitigates the common SSRF vectors (metadata endpoints, internal services, RFC1918).
 * It does NOT fully defeat DNS-rebinding (TOCTOU between resolve and connect); for that, pin the
 * resolved IP via a custom http(s) Agent lookup. Callers that need that should additionally pass an
 * allowlist so only known external providers are reachable.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

export interface SsrfCheckOptions {
  /** If non-empty, the URL host (lowercased) must exactly match one of these. */
  allowedHosts?: string[];
  /** Allowed URL protocols, e.g. ['https:']. Default: ['https:', 'http:']. */
  allowedProtocols?: string[];
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function inV4Range(ipInt: number, cidrBase: string, prefix: number): boolean {
  const baseInt = ipv4ToInt(cidrBase);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return (
    inV4Range(n, '0.0.0.0', 8) || // "this" network
    inV4Range(n, '10.0.0.0', 8) || // RFC1918
    inV4Range(n, '100.64.0.0', 10) || // CGNAT
    inV4Range(n, '127.0.0.0', 8) || // loopback
    inV4Range(n, '169.254.0.0', 16) || // link-local (incl. cloud metadata 169.254.169.254)
    inV4Range(n, '172.16.0.0', 12) || // RFC1918
    inV4Range(n, '192.0.0.0', 24) || // IETF protocol assignments
    inV4Range(n, '192.0.2.0', 24) || // TEST-NET-1
    inV4Range(n, '192.168.0.0', 16) || // RFC1918
    inV4Range(n, '198.18.0.0', 15) || // benchmarking
    inV4Range(n, '198.51.100.0', 24) || // TEST-NET-2
    inV4Range(n, '203.0.113.0', 24) || // TEST-NET-3
    inV4Range(n, '224.0.0.0', 4) || // multicast
    inV4Range(n, '240.0.0.0', 4) // reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  // IPv4-mapped (::ffff:1.2.3.4) — validate the embedded v4.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]!);
  if (addr === '::1' || addr === '::') return true; // loopback / unspecified
  if (addr.startsWith('fe80') || addr.startsWith('fe9') || addr.startsWith('fea') || addr.startsWith('feb')) return true; // link-local fe80::/10
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique local fc00::/7
  if (addr.startsWith('ff')) return true; // multicast
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP literal → treat as unsafe
}

/**
 * Throws SsrfError if the URL is unsafe to fetch; otherwise returns the parsed URL.
 */
export async function assertUrlIsSafeForEgress(rawUrl: string, opts: SsrfCheckOptions = {}): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new SsrfError('Invalid URL');
  }

  const protocols = opts.allowedProtocols ?? ['https:', 'http:'];
  if (!protocols.includes(u.protocol)) {
    throw new SsrfError(`Protocol not allowed: ${u.protocol}`);
  }

  const host = u.hostname.toLowerCase();
  if (!host) throw new SsrfError('Missing host');

  if (opts.allowedHosts && opts.allowedHosts.length > 0) {
    const ok = opts.allowedHosts.some((h) => host === h.trim().toLowerCase());
    if (!ok) throw new SsrfError(`Host not in allowlist: ${host}`);
  }

  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    throw new SsrfError('Local hostname blocked');
  }

  // Literal IP in the URL → check directly (strip IPv6 brackets handled by URL.hostname).
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new SsrfError('URL points to a private/reserved IP');
    return u;
  }

  let addresses: string[];
  try {
    const results = await dns.lookup(host, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new SsrfError('DNS resolution failed');
  }
  if (addresses.length === 0) throw new SsrfError('No DNS records for host');
  for (const a of addresses) {
    if (isPrivateIp(a)) throw new SsrfError(`Host resolves to a private/reserved IP (${a})`);
  }
  return u;
}

/** Parse a comma-separated env var into a trimmed host allowlist. */
export function parseHostAllowlist(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
