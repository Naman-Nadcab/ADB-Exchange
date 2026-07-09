/**
 * Executes infrastructure control actions (docker compose restart, queue flush signals).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { logger } from '../lib/logger.js';

const LOG = 'infra_executor';

const ACTION_SERVICE_MAP: Record<string, string> = {
  restart_worker: 'backend',
  restart_settlement_worker: 'backend',
  restart_matching_engine: 'matching-engine',
  restart_websocket_service: 'backend',
  restart_liquidity_bot: 'backend',
};

export interface InfraActionResult {
  executed: boolean;
  message: string;
  service?: string;
}

export function isDockerAvailable(): boolean {
  try {
    if (process.env.INFRA_ACTIONS_ENABLED === 'false') return false;
    if (existsSync('/var/run/docker.sock')) return true;
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function composeProjectDir(): string {
  return process.env.COMPOSE_PROJECT_DIR?.trim() || '/opt/m-live';
}

function composeFile(): string {
  return process.env.COMPOSE_FILE?.trim() || 'docker-compose.production.yml';
}

export async function executeInfrastructureAction(action: string): Promise<InfraActionResult> {
  if (action === 'flush_queue') {
    try {
      const { redis } = await import('../lib/redis.js');
      await redis.publish('admin:control', JSON.stringify({ action: 'flush_queue', ts: Date.now() })).catch(() => {});
      return { executed: true, message: 'Queue flush signal published to workers' };
    } catch (e) {
      return { executed: false, message: e instanceof Error ? e.message : 'Flush signal failed' };
    }
  }

  if (action === 'reset_circuit_breaker') {
    try {
      const { redis } = await import('../lib/redis.js');
      await redis.del('settlement:circuit:open').catch(() => {});
      await redis.del('withdrawal:circuit:open').catch(() => {});
      return { executed: true, message: 'Settlement and withdrawal circuit breakers reset in Redis' };
    } catch (e) {
      return { executed: false, message: e instanceof Error ? e.message : 'Circuit reset failed' };
    }
  }

  const service = ACTION_SERVICE_MAP[action];
  if (!service) {
    return { executed: false, message: `Unknown action: ${action}` };
  }

  if (!isDockerAvailable()) {
    logger.warn(`${LOG}: docker unavailable`, { action });
    return {
      executed: false,
      message: 'Docker not available — action audit logged only. Mount docker.sock for live restarts.',
      service,
    };
  }

  try {
    const dir = composeProjectDir();
    const file = composeFile();
    execSync(`docker compose -f ${file} restart ${service}`, {
      cwd: dir,
      stdio: 'pipe',
      timeout: 120_000,
    });
    logger.info(`${LOG}: restarted`, { action, service });
    return { executed: true, message: `Restarted ${service} via docker compose`, service };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { executed: false, message: `Restart failed: ${msg.slice(0, 500)}`, service };
  }
}

export interface ContainerInfo {
  name: string;
  service: string;
  status: string;
  state: string;
  health: string | null;
  restart_count: number;
}

export function listDockerContainers(): ContainerInfo[] {
  if (!isDockerAvailable()) return [];
  try {
    const dir = composeProjectDir();
    const file = composeFile();
    const raw = execSync(`docker compose -f ${file} ps --format json`, {
      cwd: dir,
      encoding: 'utf8',
      timeout: 30_000,
    });
    const containers: ContainerInfo[] = [];
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      try {
        const row = JSON.parse(line) as { Name?: string; Service?: string; State?: string; Status?: string; Health?: string };
        const name = row.Name ?? row.Service ?? 'unknown';
        let restartCount = 0;
        try {
          restartCount = parseInt(execSync(`docker inspect ${name} --format '{{.RestartCount}}'`, { encoding: 'utf8', timeout: 5000 }).trim(), 10) || 0;
        } catch { /* skip */ }
        containers.push({
          name,
          service: row.Service ?? name,
          status: row.Status ?? row.State ?? 'unknown',
          state: row.State ?? 'unknown',
          health: row.Health ?? null,
          restart_count: restartCount,
        });
      } catch { /* skip */ }
    }
    return containers;
  } catch {
    return [];
  }
}

export function getContainerLogs(containerName: string, tail = 100): string {
  if (!isDockerAvailable()) return 'Docker not available';
  try {
    return execSync(`docker logs ${containerName} --tail ${Math.min(500, tail)} 2>&1`, {
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 512 * 1024,
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'Failed to fetch logs';
  }
}
