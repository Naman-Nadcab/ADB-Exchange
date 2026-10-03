/**
 * Exact-match screening against OFAC-published digital currency addresses.
 *
 * Data: US government SDN list (17 U.S.C. § 105; OFAC states anyone may use the
 * advanced XML and that the files can be used to screen listed digital currency
 * addresses). This is not Chainalysis, TRM, or Elliptic. OFAC says its address
 * listings are not exhaustive. A clear result means "not an exact listed
 * address in the loaded snapshot," not "not sanctioned."
 *
 * The downloader accepts only the official OFAC URL. Admin-supplied URLs are ignored.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const OFFICIAL_PUBLIC_LISTS_PROVIDER = 'official_public_lists';
export const OFAC_SDN_ADVANCED_URL =
  'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML';
export const PUBLIC_LISTS_PARSER = 'ofac-sdn-digital-currency-v1';
export const PUBLIC_LISTS_MATCH_REASON = 'Address matches sanctions designation';
export const PUBLIC_LISTS_UNAVAILABLE_REASON = 'Sanctions service unavailable';

const DEFAULT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 60_000;

export interface PublicListManifest {
  source: 'ofac-sdn';
  sourceUrl: string;
  version: string;
  downloadedAt: string;
  sourceSha256: string;
  addressSha256: string;
  addressCount: number;
  parser: string;
}

export interface PublicListHealth {
  status: 'ready' | 'missing' | 'stale' | 'corrupt' | 'empty';
  provider: typeof OFFICIAL_PUBLIC_LISTS_PROVIDER;
  source: 'ofac-sdn' | null;
  version: string | null;
  downloadedAt: string | null;
  addressCount: number;
  maxAgeMs: number;
  coverage: 'exact-ofac-digital-currency-address';
}

export function isOfficialPublicListsProvider(provider: string): boolean {
  return provider.trim().toLowerCase() === OFFICIAL_PUBLIC_LISTS_PROVIDER;
}

export function publicListsDir(): string {
  const configured = process.env.SANCTIONS_PUBLIC_LISTS_DIR?.trim();
  return configured || path.join(process.cwd(), 'data', 'official-public-lists');
}

export function publicListsMaxAgeMs(): number {
  const hours = Number(process.env.SANCTIONS_PUBLIC_LISTS_MAX_AGE_HOURS ?? '');
  if (Number.isFinite(hours) && hours > 0) return hours * 60 * 60 * 1000;
  return DEFAULT_MAX_AGE_MS;
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertCompleteSnapshot(xml: string): void {
  const trimmed = xml.trim();
  if (trimmed.length < 64) throw new Error('snapshot too small');
  if (!/<\/(?:Sanctions|sdnList|OfficialPublicListsFixture)>\s*$/.test(trimmed)) {
    throw new Error('snapshot is partial or truncated');
  }
}

/** Pull exact digital-currency identifiers. No fuzzy name matching. */
export function extractOfacDigitalCurrencyAddresses(xml: string): string[] {
  assertCompleteSnapshot(xml);
  const found = new Set<string>();
  const idPair =
    /<idType>\s*Digital Currency Address\s*-\s*[A-Za-z0-9]+\s*<\/idType>\s*<idNumber>\s*([^<]+?)\s*<\/idNumber>/gi;
  const featurePair =
    /Digital Currency Address\s*-\s*[A-Za-z0-9]+[\s\S]{0,800}?<VersionDetail\b[^>]*>\s*([^<]+?)\s*<\/VersionDetail>/gi;
  for (const pattern of [idPair, featurePair]) {
    for (const match of xml.matchAll(pattern)) {
      const raw = match[1]?.trim() ?? '';
      if (raw.length < 8 || raw.length > 256 || /\s/.test(raw)) continue;
      found.add(raw);
    }
  }
  if (found.size === 0) throw new Error('snapshot contained no digital currency addresses');
  return [...found].sort();
}

function lookupKey(address: string): string {
  const trimmed = address.trim();
  return trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.toLowerCase() : trimmed;
}

async function writeSnapshot(
  dir: string,
  xml: string,
  sourceUrl: string,
  now: Date
): Promise<PublicListManifest> {
  const addresses = extractOfacDigitalCurrencyAddresses(xml);
  const addressJson = JSON.stringify(addresses);
  const manifest: PublicListManifest = {
    source: 'ofac-sdn',
    sourceUrl,
    version: sha256(xml).slice(0, 16),
    downloadedAt: now.toISOString(),
    sourceSha256: sha256(xml),
    addressSha256: sha256(addressJson),
    addressCount: addresses.length,
    parser: PUBLIC_LISTS_PARSER,
  };
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'source.xml'), xml);
  await writeFile(path.join(dir, 'addresses.json'), addressJson);
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

async function verifyDir(dir: string): Promise<PublicListManifest> {
  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')) as PublicListManifest;
  const source = await readFile(path.join(dir, 'source.xml'));
  const addressesRaw = await readFile(path.join(dir, 'addresses.json'), 'utf8');
  if (sha256(source) !== manifest.sourceSha256) throw new Error('source checksum mismatch');
  if (sha256(addressesRaw) !== manifest.addressSha256) throw new Error('address checksum mismatch');
  const addresses = JSON.parse(addressesRaw) as unknown;
  if (!Array.isArray(addresses) || addresses.length !== manifest.addressCount || addresses.length === 0) {
    throw new Error('address dataset empty or inconsistent');
  }
  return manifest;
}

/**
 * Replace the current snapshot only after the new one verifies.
 * A failed publish leaves the previous current snapshot in place.
 */
export async function publishOfficialPublicListSnapshot(
  root: string,
  xml: string,
  sourceUrl: string,
  now = new Date()
): Promise<PublicListManifest> {
  const staging = path.join(root, 'staging');
  const current = path.join(root, 'current');
  const previous = path.join(root, 'previous');
  await rm(staging, { recursive: true, force: true });
  const manifest = await writeSnapshot(staging, xml, sourceUrl, now);
  await verifyDir(staging);
  await rm(previous, { recursive: true, force: true });
  try {
    await rename(current, previous);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw err;
  }
  try {
    await rename(staging, current);
    await verifyDir(current);
  } catch (err) {
    await rm(current, { recursive: true, force: true }).catch(() => undefined);
    try {
      await rename(previous, current);
    } catch {
      /* no previous snapshot */
    }
    throw err;
  }
  return manifest;
}

export async function refreshOfficialPublicLists(opts: {
  dir?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: Date;
} = {}): Promise<PublicListManifest> {
  const dir = opts.dir ?? publicListsDir();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DOWNLOAD_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await new Promise<Response>((resolve, reject) => {
      const onAbort = () => reject(new Error('OFAC download timed out'));
      if (controller.signal.aborted) {
        onAbort();
        return;
      }
      controller.signal.addEventListener('abort', onAbort, { once: true });
      fetchImpl(OFAC_SDN_ADVANCED_URL, { signal: controller.signal }).then(resolve, reject);
    });
    if (!res.ok) throw new Error(`OFAC download failed: ${res.status}`);
    const xml = await res.text();
    return await publishOfficialPublicListSnapshot(dir, xml, OFAC_SDN_ADVANCED_URL, opts.now ?? new Date());
  } finally {
    clearTimeout(timer);
  }
}

export async function readOfficialPublicListsHealth(
  dir = publicListsDir(),
  now = new Date(),
  maxAgeMs = publicListsMaxAgeMs()
): Promise<PublicListHealth> {
  const base: PublicListHealth = {
    status: 'missing',
    provider: OFFICIAL_PUBLIC_LISTS_PROVIDER,
    source: null,
    version: null,
    downloadedAt: null,
    addressCount: 0,
    maxAgeMs,
    coverage: 'exact-ofac-digital-currency-address',
  };
  try {
    const manifest = await verifyDir(path.join(dir, 'current'));
    const downloadedAt = new Date(manifest.downloadedAt);
    const stale = !Number.isFinite(downloadedAt.getTime()) || now.getTime() - downloadedAt.getTime() > maxAgeMs;
    return {
      ...base,
      status: manifest.addressCount === 0 ? 'empty' : stale ? 'stale' : 'ready',
      source: manifest.source,
      version: manifest.version,
      downloadedAt: manifest.downloadedAt,
      addressCount: manifest.addressCount,
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return base;
    return { ...base, status: 'corrupt' };
  }
}

export async function screenOfficialPublicLists(params: {
  address?: string;
  dir?: string;
  now?: Date;
  maxAgeMs?: number;
}): Promise<{ allowed: boolean; reason?: string; provider: string; riskScore?: number; datasetVersion?: string }> {
  const dir = params.dir ?? publicListsDir();
  const health = await readOfficialPublicListsHealth(dir, params.now ?? new Date(), params.maxAgeMs ?? publicListsMaxAgeMs());
  if (health.status !== 'ready') {
    return { allowed: false, reason: PUBLIC_LISTS_UNAVAILABLE_REASON, provider: OFFICIAL_PUBLIC_LISTS_PROVIDER };
  }
  const address = params.address?.trim();
  if (!address) {
    return { allowed: false, reason: PUBLIC_LISTS_UNAVAILABLE_REASON, provider: OFFICIAL_PUBLIC_LISTS_PROVIDER };
  }
  const raw = await readFile(path.join(dir, 'current', 'addresses.json'), 'utf8');
  const addresses = JSON.parse(raw) as string[];
  const wanted = lookupKey(address);
  const hit = addresses.some((item) => lookupKey(item) === wanted);
  if (hit) {
    return {
      allowed: false,
      reason: PUBLIC_LISTS_MATCH_REASON,
      provider: OFFICIAL_PUBLIC_LISTS_PROVIDER,
      riskScore: 100,
      datasetVersion: health.version ?? undefined,
    };
  }
  return { allowed: true, provider: OFFICIAL_PUBLIC_LISTS_PROVIDER, riskScore: 0, datasetVersion: health.version ?? undefined };
}
