#!/usr/bin/env node
/**
 * Classifies .build/i18n-hardcoded-forensic-scan.json hits for certification.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scanPath = path.join(repoRoot, '.build/i18n-hardcoded-forensic-scan.json');
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
const hits = scan.hits ?? scan;

const msgRoot = path.join(repoRoot, 'apps/frontend/messages/en');
const catalogTexts = new Set();
function walkJson(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJson(full);
    else if (ent.name.endsWith('.json')) {
      const collect = (o) => {
        if (typeof o === 'string' && o.length > 2) catalogTexts.add(o.trim());
        else if (o && typeof o === 'object') Object.values(o).forEach(collect);
      };
      collect(JSON.parse(fs.readFileSync(full, 'utf8')));
    }
  }
}
walkJson(msgRoot);

function fileLine(fullRel, lineNo) {
  const full = path.join(repoRoot, fullRel);
  if (!fs.existsSync(full)) return '';
  return (fs.readFileSync(full, 'utf8').split('\n')[lineNo - 1] ?? '');
}

function classify(hit) {
  const { file, text } = hit;
  const t = text.trim();
  const f = file.replace(/\\/g, '/');

  if (/\/(__tests__|e2e|\.test\.|\.spec\.|mocks?\/)/.test(f)) return 'TEST_ONLY';
  if (f.endsWith('HomePageClient.tsx')) return 'DEV_ONLY';
  if (f.includes('pluginTypes.ts') || f.includes('useChartAdapter.ts')) return 'TECHNICAL_CONSTANT';
  if (/\/admin-panel\//.test(f)) return 'SERVER_NON_UI';
  if (f.includes('scripts/') && !f.includes('frontend/src/app')) return 'DEV_ONLY';
  if (/^(BTC|ETH|USDT|USDC|BNB|SOL|XRP|ADA|AVAX|DOT|MATIC|LINK|UNI|DOGE|SHIB|FIL|ICP|HBAR|VET|DAI|LTC|TRX|NEAR|SUI|APT|SEI|ARB|OP|IMX|AAVE|MKR|LDO|INJ|PEPE|WIF|FLOKI|BONK|FET|RENDER|WLD|GRT|AR|ATOM)$/i.test(t))
    return 'MARKET_SYMBOL';
  if (/^[A-Z]{2,10}$/.test(t) && t.length <= 6) return 'CURRENCY_CODE';
  if (/^(GET|POST|PUT|DELETE|PATCH)\s+\//.test(t)) return 'API_ENUM_INTERNAL';
  if (/^\/api\//.test(t) || /^POST \/|^GET \//.test(t)) return 'API_ENUM_INTERNAL';
  if (/^(FDM|Binance|Google|DigiLocker|TOTP|OTP|API|URL|HTTP|HTTPS|CSV|JWT|KYC|UPI|IMPS|PNL|P2P|FDM Card)$/i.test(t))
    return 'PRODUCT_IDENTIFIER';
  if (/^(India|United States|United Kingdom|Singapore|Australia|Canada|Germany|France|Japan|Bitcoin|Ethereum|Tether)$/i.test(t))
    return 'LEGAL_BRAND';
  if (/use[A-Z]\w+/.test(t)) return 'FALSE_POSITIVE';
  if (f.includes('exchangeProgressSteps') && /routeOrLocation|POST|GET/.test(t)) return 'TECHNICAL_CONSTANT';
  if (/\.(csv|json|tsx?)$/.test(t)) return 'FALSE_POSITIVE';
  if (t.length <= 3) return 'FALSE_POSITIVE';
  if (/^Level \d/.test(t)) return 'FINANCIAL_IDENTIFIER';
  if (/^\d/.test(t)) return 'FALSE_POSITIVE';

  const line = fileLine(hit.file, hit.line);
  if (/\bt\s*\(|useTranslations|getTranslations|tc\s*\(|tCommon\s*\(/.test(line)) return 'FALSE_POSITIVE';
  if (catalogTexts.has(t)) return 'FALSE_POSITIVE';
  if (/\{t\(|\{tc\(|\{tStates\(|\{to\(/.test(line)) return 'FALSE_POSITIVE';

  if (f.includes('/app/') || f.includes('/components/')) return 'CUSTOMER_VISIBLE';
  return 'TECHNICAL_CONSTANT';
}

const classified = hits.map((h) => ({ ...h, category: classify(h) }));
const counts = {};
for (const h of classified) counts[h.category] = (counts[h.category] || 0) + 1;

const customerUnresolved = classified.filter((h) => h.category === 'CUSTOMER_VISIBLE');

const outJson = path.join(repoRoot, '.build/i18n-hardcoded-classified.json');
fs.writeFileSync(
  outJson,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      total: classified.length,
      counts,
      customerUnresolved: customerUnresolved.length,
      hits: classified,
    },
    null,
    2
  )
);

let md = `# Hardcoded scan classification\n\nGenerated: ${new Date().toISOString()}\n\n| Category | Count |\n| --- | ---: |\n`;
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  md += `| ${k} | ${v} |\n`;
}
md += `\n**CUSTOMER unresolved (heuristic):** ${customerUnresolved.length}\n\n`;
md += `Artifact: \`i18n-hardcoded-classified.json\`\n`;

const mdPath = path.join(repoRoot, '.build/I18N_HARDCODED_STRING_CLASSIFICATION.md');
fs.writeFileSync(mdPath, md);
console.log(`Classified ${classified.length} hits; CUSTOMER_* ${counts.CUSTOMER_VISIBLE ?? 0}; written ${path.basename(mdPath)}`);
