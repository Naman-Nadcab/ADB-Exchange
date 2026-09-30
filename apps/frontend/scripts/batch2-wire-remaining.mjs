#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(process.cwd(), '../..');
const messagesRoot = path.join(process.cwd(), 'messages');

const ZH = {
  Retry: '重试', 'Referral Program': '推荐计划', 'My Referrals': '我的推荐', 'Invite Friends': '邀请好友',
  Overview: '概览', 'API Management': 'API 管理', 'Create New Key': '创建新密钥', 'Security': '安全',
  'Address Book': '地址簿', Search: '搜索', Add: '添加', Cancel: '取消', Submit: '提交', Done: '完成',
  Documentation: '文档', 'No records found.': '暂无记录。', 'Withdrawal Address': '提现地址',
};
const ID = {
  Retry: 'Coba lagi', 'Referral Program': 'Program Referral', 'My Referrals': 'Referral Saya',
  'Invite Friends': 'Undang Teman', Overview: 'Ringkasan', 'API Management': 'Manajemen API',
  'Create New Key': 'Buat Kunci Baru', Security: 'Keamanan', 'Address Book': 'Buku Alamat',
  Search: 'Cari', Add: 'Tambah', Cancel: 'Batal', Submit: 'Kirim', Done: 'Selesai',
  Documentation: 'Dokumentasi', 'No records found.': 'Tidak ada catatan.',
  'Withdrawal Address': 'Alamat Penarikan',
};

function tr(en, locale) {
  if (locale === 'en') return en;
  const map = locale === 'zh-CN' ? ZH : ID;
  return map[en] ?? en;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const WIRE = [
  {
    rel: 'apps/frontend/src/app/dashboard/referral/page.tsx',
    ns: 'account.referralProgramPage',
    pairs: [
      ['Referral Program', 'heroBadge'],
      ['Invite Friends & Earn', 'heroTitle'],
      ['Up to 1,720 USDT', 'heroReward'],
      ['Invite Friends', 'inviteFriends'],
      ['My Referrals', 'myReferrals'],
      ['Your Earnings', 'yourEarnings'],
      ['Commission Rate', 'commissionRate'],
      ['Your Referrals', 'yourReferrals'],
      ['Referral program cap', 'programCap'],
      ['Retry', 'retry'],
      ['Growth Analytics', 'growthTitle'],
      ['Track referral performance and conversion', 'growthSubtitle'],
      ['How to Get Rewards', 'howRewardsTitle'],
      ['Earn more by completing different tasks', 'howRewardsSubtitle'],
      ['Your Earnings', 'cardYourEarnings'],
      ['Per referred user', 'perReferredUser'],
      ['Total Referrals', 'totalReferrals'],
      ['Pending', 'pending'],
      ['Learn more', 'learnMore'],
      ['Tiered Commissions', 'tieredCommissions'],
      ['More referrals = Higher rate', 'moreReferralsHigher'],
      ['Up to 30%', 'upTo30'],
      ['Commission on trading fees', 'commissionOnFees'],
      ['Invite More, Earn More', 'inviteMoreTitle'],
      ['Up to', 'upTo'],
      ['Per Referred User', 'perReferredUserLabel'],
      ['How to Invite', 'howToInvite'],
      ['Share Your Code', 'shareCodeTitle'],
      ['Friends Sign Up', 'friendsSignUpTitle'],
      ['Earn Rewards', 'earnRewardsTitle'],
      ['Your Referral Details', 'referralDetailsTitle'],
      ['My Referral Code', 'myReferralCode'],
      ['My Referral Link', 'myReferralLink'],
      ['Become an Affiliate Partner', 'affiliateTitle'],
      ['Apply Now', 'applyNow'],
      ['Terms & Conditions', 'termsTitle'],
      ['View Full Terms', 'viewFullTerms'],
      ['Invite Friends', 'modalInviteTitle'],
      ['Join & Earn Rewards!', 'joinEarnRewards'],
      ['Scan to join!', 'scanToJoin'],
      ['Referral Code', 'referralCodeLabel'],
      ['Customize your message', 'customizeMessage'],
      ['Save', 'save'],
      ['Copied!', 'copied'],
      ['Copy', 'copy'],
      ['Email', 'email'],
      ['Telegram', 'telegram'],
      ['Facebook', 'facebook'],
      ['WhatsApp', 'whatsapp'],
      ['LinkedIn', 'linkedin'],
      ['Line', 'line'],
      ['More', 'more'],
    ],
  },
  {
    rel: 'apps/frontend/src/app/dashboard/referral/my-referrals/page.tsx',
    ns: 'account.myReferralsPage',
    pairs: [
      ['Referral Program', 'breadcrumbReferral'],
      ['My Referrals', 'breadcrumbCurrent'],
      ['Overview', 'overview'],
      ['Retry', 'retry'],
      ['Total Commissions', 'totalCommissions'],
      ['Sign Up', 'signUp'],
      ['P2P volume', 'p2pVolume'],
      ['Card', 'card'],
      ['Earn', 'earn'],
      ['My Commission Rate', 'myCommissionRate'],
      ['Total Commission', 'totalCommission'],
      ['Claimable Balance', 'claimableBalance'],
      ['Claim to balance', 'claimToBalance'],
      ['Total Bonus', 'totalBonus'],
      ['Mystery Box', 'mysteryBox'],
      ['Earned rewards', 'earnedRewards'],
      ['Rewards History', 'rewardsHistory'],
      ['Commission History', 'commissionHistoryTab'],
      ['Task Rewards History', 'taskRewardsTab'],
      ['Lucky Draw Prizes', 'luckyDrawTab'],
      ['Spot', 'spot'],
      ['No records found.', 'noRecords'],
      ['Invite Friends', 'inviteFriends'],
      ['Total Rewards', 'totalRewards'],
      ['Tasks Completed by Friends', 'tasksCompleted'],
      ['Tasks Claimed by Friends', 'tasksClaimed'],
      ['Commissions', 'commissions'],
      ['Total Applications', 'totalApplications'],
      ['Referral History', 'referralHistory'],
      ['Total Friends', 'totalFriends'],
      ['Qualified Friends', 'qualifiedFriends'],
      ['Email', 'colEmail'],
      ['Username', 'colUsername'],
      ['Status', 'colStatus'],
      ['Commission earned', 'colCommissionEarned'],
      ['Joined', 'colJoined'],
      ['No referrals yet.', 'noReferralsYet'],
      ['Recent commission history', 'recentCommissionHistory'],
      ['Source', 'colSource'],
      ['Amount', 'colAmount'],
      ['Date', 'colDate'],
      ['Signups', 'tabSignups'],
      ['Fiat', 'tabFiat'],
      ['Card', 'tabCard'],
      ['Earn', 'tabEarn'],
      ['About', 'footerAbout'],
      ['Services', 'footerServices'],
      ['Support', 'footerSupport'],
      ['Products', 'footerProducts'],
      ['About FDM', 'footerAboutFdm'],
      ['Announcements', 'footerAnnouncements'],
      ['Fees & Transactions Overview', 'footerFees'],
      ['P2P Trading (0 Fees)', 'footerP2p'],
      ['Referral Program', 'footerReferral'],
      ['API', 'footerApi'],
      ['Help Center', 'footerHelp'],
      ['Trading Fee', 'footerTradingFee'],
      ['Trade', 'footerTrade'],
      ['P2P', 'footerP2pShort'],
      ['Markets', 'footerMarkets'],
      ['Terms of Service', 'footerTerms'],
      ['Privacy Terms', 'footerPrivacy'],
    ],
  },
  {
    rel: 'apps/frontend/src/app/dashboard/api/page.tsx',
    ns: 'account.apiManagementPage',
    pairs: [
      ['FDM OpenAPI V5', 'bannerTitle'],
      ['API Management', 'title'],
      ['Create New Key', 'createNewKey'],
      ['Security', 'securityCardTitle'],
      ['IP Whitelisting recommended', 'ipWhitelistRecommended'],
      ['Community', 'communityTitle'],
      ['Join our Telegram', 'joinTelegram'],
      ['English Group →', 'englishGroup'],
      ['中文群组 →', 'chineseGroup'],
      ['Security', 'securitySection'],
      ['Documentation', 'documentationSection'],
      ['API Key Records', 'recordsTitle'],
      ['Your active API keys and their permissions', 'recordsSubtitle'],
      ['Name', 'colName'],
      ['Type', 'colType'],
      ['API Key', 'colApiKey'],
      ['Secret', 'colSecret'],
      ['Permission', 'colPermission'],
      ['IP Bound', 'colIpBound'],
      ['Created', 'colCreated'],
      ['Expires', 'colExpires'],
      ['Actions', 'colActions'],
      ['No API Keys Yet', 'emptyTitle'],
      ['Create Your First Key', 'createFirstKey'],
      ['Security Recommendations', 'securityNoticeTitle'],
      ['Never share your API secret with anyone', 'secTip1'],
      ['Add IP addresses to your keys for enhanced security', 'secTip2'],
      ['Regularly rotate your API keys', 'secTip3'],
      ["Use read-only permissions when write access isn't needed", 'secTip4'],
      ['Edit API Key', 'editModalTitle'],
      ['Key Name', 'keyName'],
      ['Permission', 'permissionLabel'],
      ['IP Restriction', 'ipRestrictionLabel'],
      ['Cancel', 'cancel'],
      ['Save changes', 'saveChanges'],
      ['Select Your API Key Type', 'typeModalTitle'],
      ['System-generated API Keys', 'systemKeysTitle'],
      ['Self-generated API Keys', 'selfKeysTitle'],
      ['Recommended', 'recommended'],
      ['Easier Setup', 'easierSetup'],
      ['Advanced', 'advanced'],
      ['API v3 & v5', 'apiV3V5'],
      ['Confirm revoke', 'confirmRevoke'],
      ['Revoking…', 'revoking'],
      ['Read-Write', 'readWrite'],
      ['Read-Only', 'readOnly'],
      ['None', 'none'],
      ['HMAC', 'hmac'],
      ['RSA', 'rsa'],
      ['API Transaction', 'apiTransaction'],
      ['Third-Party', 'thirdParty'],
      [' IPs', 'ipsSuffix'],
      ['Never', 'never'],
      ['Expired', 'expired'],
      ['Documentation', 'documentationLink'],
    ],
  },
  {
    rel: 'apps/frontend/src/app/dashboard/api/create/page.tsx',
    ns: 'account.apiCreatePage',
    pairs: [
      ['API', 'breadcrumbApi'],
      ['Create New Key', 'breadcrumbCreate'],
      ['System-generated API Key', 'titleSystem'],
      ['Self-generated API Key', 'titleSelf'],
      ['API Key Usage', 'usageTitle'],
      ['API Transaction', 'usageTransaction'],
      ['Third-Party Applications', 'usageThirdParty'],
      ['Your Public Key *', 'publicKeyTitle'],
      ['Key Configuration', 'configTitle'],
      ['Key Name *', 'keyNameLabel'],
      ['Permission Level', 'permissionLevel'],
      ['Read-Only', 'readOnly'],
      ['Read-Write', 'readWrite'],
      ['IP Security', 'ipSecurityTitle'],
      ['IP Whitelist', 'ipWhitelist'],
      ['No IP Restriction', 'noIpRestriction'],
      ['IP Addresses (comma separated)', 'ipAddressesLabel'],
      ['API Permissions', 'permissionsTitle'],
      ['Select which features this key can access', 'permissionsSubtitle'],
      ['Trading', 'sectionTrading'],
      ['Earn', 'sectionEarn'],
      ['Fiat Trading', 'sectionFiat'],
      ['Assets', 'sectionAssets'],
      ['Creating...', 'creating'],
      ['Create API Key', 'createButton'],
      ['Cancel', 'cancel'],
      ['API Key Created!', 'successTitle'],
      ['Done', 'done'],
      ['Recommended', 'recommended'],
      ['Loading...', 'loading'],
    ],
  },
  {
    rel: 'apps/frontend/src/app/dashboard/address-book/page.tsx',
    ns: 'account.addressBookPage',
    pairs: [
      ['Withdrawal Address', 'title'],
      ['Withdraw via Address Book', 'withdrawViaAddressBook'],
      ['Set Up', 'setUp'],
      ['Add', 'add'],
      ['Add in Batches', 'addInBatches'],
      ['Type:', 'typeLabel'],
      ['Assets:', 'assetsLabel'],
      ['Search Address:', 'searchAddressLabel'],
      ['Search', 'search'],
      ['Withdrawal Address Whitelist', 'whitelistTitle'],
      ['Assets', 'colAssets'],
      ['Network', 'colNetwork'],
      ['Note', 'colNote'],
      ['Withdrawal Address', 'colAddress'],
      ['Memo/Tag', 'colMemo'],
      ['Last Updated', 'colUpdated'],
      ['Change', 'colChange'],
      ['No Records', 'noRecords'],
      ['Security Verification', 'securityVerification'],
      ['Verify & Enable', 'verifyEnable'],
      ['All', 'filterAll'],
      ['Regular Wallet Address', 'typeRegular'],
      ['Universal Wallet Address', 'typeUniversal'],
      ['Internal Transfer', 'typeInternal'],
      ['Search...', 'searchPlaceholder'],
      ['No assets found', 'noAssetsFound'],
    ],
  },
];

function buildCatalog() {
  /** @type {Record<string, Record<string, Record<string, string>>>} */
  const byPage = {};
  for (const { ns, pairs } of WIRE) {
    const pageKey = ns.split('.')[1];
    byPage[pageKey] = { en: {}, 'zh-CN': {}, 'id-ID': {} };
    for (const [text, key] of pairs) {
      byPage[pageKey].en[key] = text;
      byPage[pageKey]['zh-CN'][key] = tr(text, 'zh-CN');
      byPage[pageKey]['id-ID'][key] = tr(text, 'id-ID');
    }
  }
  return byPage;
}

const catalog = buildCatalog();

for (const locale of ['en', 'zh-CN', 'id-ID']) {
  const acc = JSON.parse(fs.readFileSync(path.join(messagesRoot, locale, 'account.json'), 'utf8'));
  for (const [pageKey, locales] of Object.entries(catalog)) {
    acc[pageKey] = { ...(acc[pageKey] || {}), ...locales[locale] };
  }
  fs.writeFileSync(path.join(messagesRoot, locale, 'account.json'), JSON.stringify(acc, null, 2) + '\n');
}

function ensureHooks(content, ns) {
  if (content.includes(`useTranslations('${ns}')`)) return content;
  const hook = `
  const t = useTranslations('${ns}');
  const tc = useTranslations('account.common');
  const ts = useTranslations('security.common');
  const { fromApi, networkUnreachable } = useApiErrorMessage();`;
  if (!content.includes('useApiErrorMessage')) {
    content = content.replace(
      /import \{ useTranslations \} from 'next-intl';/,
      `import { useTranslations } from 'next-intl';\nimport { useApiErrorMessage } from '@/hooks/useApiErrorMessage';`
    );
  }
  const m = content.match(/export default function \w+\(\) \{/) || content.match(/function CreateApiKeyContent\(\) \{/);
  if (m) {
    const idx = content.indexOf(m[0]) + m[0].length;
    content = content.slice(0, idx) + hook + content.slice(idx);
  }
  return content;
}

function wireFile(rel, ns, pairs) {
  const filePath = path.join(repoRoot, rel);
  let content = fs.readFileSync(filePath, 'utf8');
  content = ensureHooks(content, ns);
  const sorted = [...pairs].sort((a, b) => b[0].length - a[0].length);
  for (const [text, key] of sorted) {
    if (text.length < 2) continue;
    const esc = escapeRegExp(text);
    content = content.replace(new RegExp(`>\\s*${esc}\\s*<`, 'g'), `>{t('${key}')}<`);
    content = content.replace(new RegExp(`>\\s*\\n\\s*${esc}\\s*\\n\\s*<`, 'g'), `>\n                {t('${key}')}\n              <`);
    content = content.replace(new RegExp(`placeholder="${esc}"`, 'g'), `placeholder={t('${key}')}`);
    content = content.replace(new RegExp(`title="${esc}"`, 'g'), `title={t('${key}')}`);
    content = content.replace(new RegExp(`aria-label="${esc}"`, 'g'), `aria-label={t('${key}')}`);
  }
  content = content.replace(
    /setFetchError\(result\.error\?\.message \|\| 'Failed to load referral data'\)/g,
    "setFetchError(result.error?.message ? fromApi(result.error) : t('loadFailed'))"
  );
  content = content.replace(
    /setFetchError\(res\.error\?\.message \|\| 'Failed to load referral data'\)/g,
    "setFetchError(res.error?.message ? fromApi(res.error) : t('loadFailed'))"
  );
  content = content.replace(
    /setFetchError\('Network error\. Please try again\.'\)/g,
    'setFetchError(networkUnreachable())'
  );
  content = content.replace(
    /description: res\.error\?\.message \|\| tt\('noClaimableEarnings'\)/g,
    "description: res.error?.message ? fromApi(res.error) : tt('noClaimableEarnings')"
  );
  fs.writeFileSync(filePath, content);
}

for (const { rel, ns, pairs } of WIRE) {
  wireFile(rel, ns, pairs);
  const pageKey = ns.split('.')[1];
  const en = catalog[pageKey].en;
  if (!en.loadFailed) {
    for (const locale of ['en', 'zh-CN', 'id-ID']) {
      const acc = JSON.parse(fs.readFileSync(path.join(messagesRoot, locale, 'account.json'), 'utf8'));
      acc[pageKey].loadFailed = locale === 'en' ? 'Failed to load referral data' : locale === 'zh-CN' ? '加载推荐数据失败' : 'Gagal memuat data referral';
      fs.writeFileSync(path.join(messagesRoot, locale, 'account.json'), JSON.stringify(acc, null, 2) + '\n');
    }
  }
}

console.log('batch2-wire-remaining: done', WIRE.length, 'pages');
