/**
 * Isolated API for STEP 19 browser certification. Binds 127.0.0.1 only.
 * Refuses database name exchange/postgres and the production host.
 */
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const port = Number(process.env.STEP19_API_PORT ?? '4019');
const testUrl = process.env.STEP19_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.STEP19_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('STEP19_DATABASE_URL and STEP19_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
const redisUrl = new URL(redisUrlRaw);
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '' || testUrl.includes('169.58.39.2')) {
  console.error('Refusing to start against a non-isolated database');
  process.exit(1);
}
if (redisUrl.port === '6379' || (redisUrl.hostname !== '127.0.0.1' && redisUrl.hostname !== 'localhost')) {
  console.error('Refusing non-local Redis');
  process.exit(1);
}

process.env.NODE_ENV = 'test';
process.env.EXCHANGE_PRESERVE_SHELL_DATABASE_URL = '1';
process.env.DATABASE_URL = testUrl;
process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false';
process.env.REDIS_URL = redisUrlRaw;
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';
process.env.SANCTIONS_PROVIDER = 'noop';
process.env.ADMIN_2FA_MANDATORY = 'false';
process.env.AUTH_COOKIE_SECURE = 'false';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-must-be-32-characters';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-32-characters-min';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'test-encryption-key-32-characters-min';
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-32-characters-min';
process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? 'test-csrf-secret-must-be-32-chars-min';
process.env.PRICE_ORACLE_ENABLED = 'false';
process.env.RUN_MODE = 'api';

async function seedAdmins(pool: Pool): Promise<void> {
  const hash = await bcrypt.hash('Step19-admin-pass', 4);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, name, role, is_active)
     VALUES ('step19-admin@isolated.test', $1, 'Step19 Admin', 'super_admin', TRUE)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE, failed_login_attempts = 0, locked_until = NULL`,
    [hash]
  );
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, name, role, is_active)
     VALUES ('step19-compliance@isolated.test', $1, 'Step19 Compliance', 'compliance', TRUE)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE, role = 'compliance'`,
    [hash]
  );
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: testUrl, ssl: false });
  const current = await pool.query<{ current_database: string }>('SELECT current_database()');
  if (current.rows[0]?.current_database !== databaseName) {
    throw new Error(`database mismatch ${current.rows[0]?.current_database}`);
  }
  await seedAdmins(pool);
  await pool.end();

  const { default: Fastify } = await import('fastify');
  const cookie = (await import('@fastify/cookie')).default;
  const cors = (await import('@fastify/cors')).default;
  const jwtPlugin = (await import('@fastify/jwt')).default;
  const websocket = (await import('@fastify/websocket')).default;
  const { config } = await import('../src/config/index.js');
  const { isSessionValid } = await import('../src/services/session.service.js');
  const { ACCESS_COOKIE } = await import('../src/lib/auth-cookies.js');
  const { default: walletLoginRoutes } = await import('../src/routes/auth-wallet-login.fastify.js');
  const { default: walletChallengeRoutes } = await import('../src/routes/auth-wallet-challenge.fastify.js');
  const { default: walletVerifyRoutes } = await import('../src/routes/auth-wallet-verify.fastify.js');
  const { default: walletManagementRoutes } = await import('../src/routes/auth-wallet-management.fastify.js');
  const { default: cutoverRoutes } = await import('../src/routes/auth-legacy-cutover.fastify.js');
  const { default: authRoutes } = await import('../src/routes/auth.fastify.js');
  const { default: walletRoutes } = await import('../src/routes/wallet.fastify.js');
  const { default: forexRoutes } = await import('../src/routes/forex.fastify.js');
  const { default: adminForexRoutes } = await import('../src/routes/admin-forex.fastify.js');
  const { default: adminRoutes } = await import('../src/routes/admin.fastify.js');

  const app = Fastify({ logger: false });
  await app.register(cors, {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key', 'x-forex-account-id'],
  });
  await app.register(cookie, { secret: config.security.sessionSecret });
  await app.register(jwtPlugin, { secret: config.jwt.secret });
  await app.register(websocket);
  app.addHook('onRequest', async (request) => {
    if (!request.headers.authorization?.startsWith('Bearer ')) {
      const cookieToken = request.cookies?.[ACCESS_COOKIE];
      if (typeof cookieToken === 'string' && cookieToken.length > 0) {
        request.headers.authorization = `Bearer ${cookieToken}`;
      }
    }
  });
  const authenticate = async (request: { headers: { authorization?: string }; user?: unknown }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    const token = request.headers.authorization?.replace(/^Bearer /, '');
    if (!token) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const decoded = app.jwt.verify<{ userId: string; email?: string; role?: string; sessionId: string; type?: string }>(token);
      if (decoded.type === 'admin' || decoded.type === 'refresh') {
        return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Use user token' } });
      }
      if (!(await isSessionValid(decoded.sessionId))) {
        return reply.status(401).send({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
      }
      request.user = { id: decoded.userId, email: decoded.email, role: decoded.role ?? 'user', sessionId: decoded.sessionId };
    } catch {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
    }
  };
  app.decorate('authenticate', authenticate);
  app.decorate('authenticateUser', authenticate);

  await app.register(walletChallengeRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletVerifyRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletLoginRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletManagementRoutes, { prefix: '/api/v1/auth' });
  await app.register(cutoverRoutes, { prefix: '/api/v1/auth' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletRoutes, { prefix: '/api/v1/wallet' });
  await app.register(forexRoutes, { prefix: '/api/v1/forex' });
  await app.register(adminForexRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  app.get('/health/live', async () => ({ status: 'alive', database: databaseName }));
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`STEP19_API_READY port=${port} database=${databaseName}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
