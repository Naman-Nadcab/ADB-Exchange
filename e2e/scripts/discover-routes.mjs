#!/usr/bin/env node
/**
 * Discover Next.js app routes from page.tsx files.
 * Dynamic segments replaced with sample values for browser audit.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const DYNAMIC_SAMPLES = {
  symbol: 'BTC_USDT',
  id: 'a0000000-0000-4000-8000-000000000001',
  orderId: 'a0000000-0000-4000-8000-000000000002',
  userId: 'a0000000-0000-4000-8000-000000000003',
  type: 'buy',
  crypto: 'BTC',
  fiat: 'USD',
};

function walkPages(dir, appRoot) {
  const routes = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    const pagePath = join(full, 'page.tsx');
    try {
      statSync(pagePath);
      const rel = relative(appRoot, full).replace(/\\/g, '/');
      routes.push(filePathToRoute(rel));
    } catch {
      /* no page.tsx */
    }
    routes.push(...walkPages(full, appRoot));
  }
  return routes;
}

function filePathToRoute(relDir) {
  let p = relDir
    .replace(/\/page\.tsx$/, '')
    .replace(/^page\.tsx$/, '')
    .replace(/\([^)]+\)\/?/g, '')
    .replace(/\/page$/, '');
  if (!p || p === '.') p = '';
  const segments = p.split('/').filter(Boolean);
  const urlSegments = segments.map((seg) => {
    if (seg.startsWith('[') && seg.endsWith(']')) {
      const key = seg.slice(1, -1);
      return DYNAMIC_SAMPLES[key] ?? 'sample';
    }
    return seg;
  });
  return '/' + urlSegments.join('/');
}

function discover(app, prefix = '') {
  const appRoot = join(ROOT, 'apps', app, 'src', 'app');
  const raw = walkPages(appRoot, appRoot);
  const unique = [...new Set(raw.map((r) => (r === '/' ? '/' : r.replace(/\/$/, ''))))];
  return unique.sort().map((path) => ({ app, path: prefix + (path === '/' ? '' : path), fullPath: path }));
}

const user = discover('frontend', '');
const admin = discover('admin-panel', '/admin');

const out = {
  generatedAt: new Date().toISOString(),
  userRoutes: user,
  adminRoutes: admin,
  total: user.length + admin.length,
};

console.log(JSON.stringify(out, null, 2));
