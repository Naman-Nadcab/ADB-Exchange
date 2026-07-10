export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (!__DEV__ && level === 'debug') return;
  const entry = { level, msg, ts: new Date().toISOString(), ...meta };
  // Provider connection Sprint 1+
  console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
}
