#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'messages');

const codesEn = {
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again in a few minutes.',
  KYC_REQUIRED: 'Identity verification is required to continue.',
  WITHDRAWAL_LIMIT_EXCEEDED: 'You have reached your withdrawal limit. Check your limits in Security settings.',
  COOLDOWN_ACTIVE: 'This action is temporarily unavailable due to a recent security change. Please check the time shown.',
  INSUFFICIENT_BALANCE: 'Insufficient balance to complete this action.',
  INVALID_2FA: 'Invalid two-factor code. Please try again.',
  FUND_PASSWORD_REQUIRED: 'Fund password is required for this action.',
  INTERNAL_ERROR: 'Something went wrong. Please try again later.',
  FETCH_FAILED: 'We could not load this information. Please try again.',
  USER_NOT_FOUND: 'Account not found.',
  UPDATE_FAILED: 'Update failed. Please try again.',
  NOT_FOUND: 'The requested item was not found.',
  INVALID_ORDER: 'Invalid order. Check market, side, type, and quantity.',
  MARKET_NOT_FOUND: 'Trading pair not found.',
  MARKET_DISABLED: 'This market is temporarily unavailable.',
  MIN_QTY: 'Quantity is below the minimum for this market.',
  MIN_NOTIONAL: 'Order value is below the minimum for this market.',
  MARKET_NOT_READY: 'Market is not ready for trading.',
  NO_LIQUIDITY: 'No liquidity available for a market order. Try a limit order.',
  FOK_NOT_FILLABLE: 'Fill-or-Kill order could not be fully filled.',
  INSUFFICIENT_QUOTE_BALANCE: 'Insufficient quote balance (including fee).',
  INSUFFICIENT_BASE_BALANCE: 'Insufficient base balance.',
  TRADING_HALTED: 'Trading is temporarily disabled.',
  MM_EMERGENCY_STOPPED: 'Trading is suspended for your account. Contact support.',
  ORDER_NOT_CANCELLABLE: 'This order can no longer be cancelled.',
  ORDER_FAILED: 'Order could not be placed. Please try again.',
  CANCEL_FAILED: 'Could not cancel order. Please try again.',
  MARKET_PAUSED: 'Trading is temporarily paused for this market. Please try again later.',
  NETWORK_ERROR:
    'Connection issue. Your request may not have reached the server. Safe to try again—no funds have been moved.',
  UNAUTHORIZED: 'Session expired or not authenticated. Please log in again.',
  INVALID_TOKEN: 'Session expired or invalid. Please log in again.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  ADMIN_IP_NOT_ALLOWED: 'Admin access is not allowed from this IP address.',
  NO_UPDATES: 'No changes to save.',
  INVALID_STATUS: 'Invalid status. Use active, maintenance, or disabled.',
};

const codesZh = {
  RATE_LIMIT_EXCEEDED: '请求过于频繁，请几分钟后再试。',
  KYC_REQUIRED: '需要完成身份验证才能继续。',
  WITHDRAWAL_LIMIT_EXCEEDED: '已达到提现限额，请在安全设置中查看限额。',
  COOLDOWN_ACTIVE: '因近期安全变更，此操作暂时不可用，请查看所示时间。',
  INSUFFICIENT_BALANCE: '余额不足，无法完成此操作。',
  INVALID_2FA: '两步验证码无效，请重试。',
  FUND_PASSWORD_REQUIRED: '此操作需要资金密码。',
  INTERNAL_ERROR: '出现问题，请稍后重试。',
  FETCH_FAILED: '无法加载信息，请重试。',
  USER_NOT_FOUND: '未找到账户。',
  UPDATE_FAILED: '更新失败，请重试。',
  NOT_FOUND: '未找到请求的项目。',
  INVALID_ORDER: '订单无效，请检查市场、方向、类型和数量。',
  MARKET_NOT_FOUND: '未找到交易对。',
  MARKET_DISABLED: '该市场暂时不可用。',
  MIN_QTY: '数量低于该市场最小值。',
  MIN_NOTIONAL: '订单金额低于该市场最小值。',
  MARKET_NOT_READY: '市场尚未就绪，无法交易。',
  NO_LIQUIDITY: '市价单无可用流动性，请尝试限价单。',
  FOK_NOT_FILLABLE: '全部成交或取消（FOK）订单无法完全成交。',
  INSUFFICIENT_QUOTE_BALANCE: '报价资产余额不足（含手续费）。',
  INSUFFICIENT_BASE_BALANCE: '基础资产余额不足。',
  TRADING_HALTED: '交易已暂时停用。',
  MM_EMERGENCY_STOPPED: '您的账户交易已暂停，请联系支持。',
  ORDER_NOT_CANCELLABLE: '该委托已无法撤销。',
  ORDER_FAILED: '无法下单，请重试。',
  CANCEL_FAILED: '无法撤销委托，请重试。',
  MARKET_PAUSED: '该市场交易已暂停，请稍后重试。',
  NETWORK_ERROR: '连接问题，请求可能未到达服务器。可安全重试，资金未变动。',
  UNAUTHORIZED: '会话已过期或未登录，请重新登录。',
  INVALID_TOKEN: '会话已过期或无效，请重新登录。',
  SESSION_EXPIRED: '会话已过期，请重新登录。',
  FORBIDDEN: '您无权执行此操作。',
  ADMIN_IP_NOT_ALLOWED: '不允许从此 IP 访问管理功能。',
  NO_UPDATES: '没有可保存的更改。',
  INVALID_STATUS: '状态无效，请使用 active、maintenance 或 disabled。',
};

const codesId = {
  RATE_LIMIT_EXCEEDED: 'Terlalu banyak permintaan. Coba lagi dalam beberapa menit.',
  KYC_REQUIRED: 'Verifikasi identitas diperlukan untuk melanjutkan.',
  WITHDRAWAL_LIMIT_EXCEEDED: 'Anda mencapai batas penarikan. Periksa batas di pengaturan Keamanan.',
  COOLDOWN_ACTIVE: 'Aksi ini sementara tidak tersedia karena perubahan keamanan. Periksa waktu yang ditampilkan.',
  INSUFFICIENT_BALANCE: 'Saldo tidak cukup untuk menyelesaikan aksi ini.',
  INVALID_2FA: 'Kode two-factor tidak valid. Coba lagi.',
  FUND_PASSWORD_REQUIRED: 'Password dana diperlukan untuk aksi ini.',
  INTERNAL_ERROR: 'Terjadi kesalahan. Coba lagi nanti.',
  FETCH_FAILED: 'Kami tidak dapat memuat informasi ini. Coba lagi.',
  USER_NOT_FOUND: 'Akun tidak ditemukan.',
  UPDATE_FAILED: 'Pembaruan gagal. Coba lagi.',
  NOT_FOUND: 'Item yang diminta tidak ditemukan.',
  INVALID_ORDER: 'Order tidak valid. Periksa pasar, sisi, tipe, dan kuantitas.',
  MARKET_NOT_FOUND: 'Pasangan trading tidak ditemukan.',
  MARKET_DISABLED: 'Pasar ini sementara tidak tersedia.',
  MIN_QTY: 'Kuantitas di bawah minimum untuk pasar ini.',
  MIN_NOTIONAL: 'Nilai order di bawah minimum untuk pasar ini.',
  MARKET_NOT_READY: 'Pasar belum siap untuk trading.',
  NO_LIQUIDITY: 'Tidak ada likuiditas untuk order market. Coba order limit.',
  FOK_NOT_FILLABLE: 'Order Fill-or-Kill tidak dapat terisi penuh.',
  INSUFFICIENT_QUOTE_BALANCE: 'Saldo quote tidak cukup (termasuk biaya).',
  INSUFFICIENT_BASE_BALANCE: 'Saldo base tidak cukup.',
  TRADING_HALTED: 'Trading sementara dinonaktifkan.',
  MM_EMERGENCY_STOPPED: 'Trading ditangguhkan untuk akun Anda. Hubungi dukungan.',
  ORDER_NOT_CANCELLABLE: 'Order ini tidak dapat dibatalkan lagi.',
  ORDER_FAILED: 'Order tidak dapat ditempatkan. Coba lagi.',
  CANCEL_FAILED: 'Tidak dapat membatalkan order. Coba lagi.',
  MARKET_PAUSED: 'Trading untuk pasar ini dijeda sementara. Coba lagi nanti.',
  NETWORK_ERROR:
    'Masalah koneksi. Permintaan mungkin tidak sampai ke server. Aman untuk coba lagi—dana tidak dipindahkan.',
  UNAUTHORIZED: 'Sesi kedaluwarsa atau belum autentikasi. Silakan masuk lagi.',
  INVALID_TOKEN: 'Sesi kedaluwarsa atau tidak valid. Silakan masuk lagi.',
  SESSION_EXPIRED: 'Sesi Anda kedaluwarsa. Silakan masuk lagi.',
  FORBIDDEN: 'Anda tidak memiliki izin untuk melakukan aksi ini.',
  ADMIN_IP_NOT_ALLOWED: 'Akses admin tidak diizinkan dari alamat IP ini.',
  NO_UPDATES: 'Tidak ada perubahan untuk disimpan.',
  INVALID_STATUS: 'Status tidak valid. Gunakan active, maintenance, atau disabled.',
};

const extras = {
  en: {
    cancelFailed: 'Cancel failed',
    cancelAllFailed: 'Cancel all failed',
    connectionIssue: 'Connection issue. Try again.',
  },
  'zh-CN': {
    cancelFailed: '撤销失败',
    cancelAllFailed: '全部撤销失败',
    connectionIssue: '连接问题，请重试。',
  },
  'id-ID': {
    cancelFailed: 'Gagal batalkan',
    cancelAllFailed: 'Gagal batalkan semua',
    connectionIssue: 'Masalah koneksi. Coba lagi.',
  },
};

const codeMaps = { en: codesEn, 'zh-CN': codesZh, 'id-ID': codesId };

for (const locale of ['en', 'zh-CN', 'id-ID']) {
  const file = path.join(root, locale, 'errors.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.trading = { ...extras[locale], codes: codeMaps[locale] };
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log('updated errors', locale);
}
