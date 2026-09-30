#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { accountSections } from './dashboard-account-i18n-data.mjs';

const root = path.join(process.cwd(), 'messages');

const spotWalletPage = {
  en: {
    title: 'Spot / Trading Account',
    subtitle: 'Balances used for spot orders',
    hideBalances: 'Hide balances',
    showBalances: 'Show balances',
    refreshAria: 'Refresh',
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    transfer: 'Transfer',
    estimatedTotal: 'Estimated total',
    spotWallet: 'Spot wallet ({currency})',
    available: 'Available',
    availableHint: 'Free for new orders',
    inOpenOrders: 'In open orders',
    lockedMargin: 'Locked margin',
    loadSpotBalancesFailed: 'Failed to load spot balances',
    searchCoin: 'Search coin…',
    clearSearchAria: 'Clear search',
    hideSmallBalances: 'Hide small balances (under {amount})',
    assetCount: '{count} asset',
    assetCountPlural: '{count} assets',
    colCoin: 'Coin',
    colTotalBalance: 'Total balance',
    colAvailable: 'Available',
    colInOrder: 'In order',
    colValue: '{currency} value',
    colActions: 'Actions',
    actionDeposit: 'Deposit',
    actionWithdraw: 'Withdraw',
    actionTrade: 'Trade',
    noMatchingAssets: 'No matching assets',
    emptyFilterHideSmall:
      '"Hide small balances" is hiding rows under {amount}. Turn it off or search by symbol.',
    emptyFilterSearch: 'Try another search term or clear the filter.',
    emptyFilterAdjust: 'Adjust filters to see more rows.',
    emptyTitle: 'No spot balances yet',
    emptyDescription: 'Transfer from Funding to Spot when you\'re ready to trade, or deposit first.',
    emptyAction: 'Assets overview',
    showingRange: 'Showing {start}–{end} of {total}',
    portfolioTotal: 'Portfolio total:',
    previous: 'Previous',
    next: 'Next',
    pageOf: 'Page {page} / {pages}',
  },
  'zh-CN': {
    title: '现货 / 交易账户',
    subtitle: '用于现货下单的余额',
    hideBalances: '隐藏余额',
    showBalances: '显示余额',
    refreshAria: '刷新',
    deposit: '充值',
    withdraw: '提现',
    transfer: '划转',
    estimatedTotal: '预估总额',
    spotWallet: '现货钱包（{currency}）',
    available: '可用',
    availableHint: '可用于新订单',
    inOpenOrders: '未成交订单中',
    lockedMargin: '锁定保证金',
    loadSpotBalancesFailed: '加载现货余额失败',
    searchCoin: '搜索币种…',
    clearSearchAria: '清除搜索',
    hideSmallBalances: '隐藏小额余额（低于 {amount}）',
    assetCount: '{count} 个资产',
    assetCountPlural: '{count} 个资产',
    colCoin: '币种',
    colTotalBalance: '总余额',
    colAvailable: '可用',
    colInOrder: '订单中',
    colValue: '{currency} 估值',
    colActions: '操作',
    actionDeposit: '充值',
    actionWithdraw: '提现',
    actionTrade: '交易',
    noMatchingAssets: '没有匹配的资产',
    emptyFilterHideSmall: '“隐藏小额余额”正在隐藏低于 {amount} 的行。请关闭该选项或按符号搜索。',
    emptyFilterSearch: '请尝试其他搜索词或清除筛选。',
    emptyFilterAdjust: '调整筛选条件以查看更多行。',
    emptyTitle: '暂无现货余额',
    emptyDescription: '准备交易时从资金账户划转到现货，或先充值。',
    emptyAction: '资产总览',
    showingRange: '显示 {start}–{end}，共 {total} 条',
    portfolioTotal: '组合总额：',
    previous: '上一页',
    next: '下一页',
    pageOf: '第 {page} / {pages} 页',
  },
  'id-ID': {
    title: 'Spot / Akun Trading',
    subtitle: 'Saldo untuk order spot',
    hideBalances: 'Sembunyikan saldo',
    showBalances: 'Tampilkan saldo',
    refreshAria: 'Muat ulang',
    deposit: 'Deposit',
    withdraw: 'Tarik',
    transfer: 'Transfer',
    estimatedTotal: 'Perkiraan total',
    spotWallet: 'Dompet spot ({currency})',
    available: 'Tersedia',
    availableHint: 'Bebas untuk order baru',
    inOpenOrders: 'Di order terbuka',
    lockedMargin: 'Margin terkunci',
    loadSpotBalancesFailed: 'Gagal memuat saldo spot',
    searchCoin: 'Cari koin…',
    clearSearchAria: 'Hapus pencarian',
    hideSmallBalances: 'Sembunyikan saldo kecil (di bawah {amount})',
    assetCount: '{count} aset',
    assetCountPlural: '{count} aset',
    colCoin: 'Koin',
    colTotalBalance: 'Total saldo',
    colAvailable: 'Tersedia',
    colInOrder: 'Di order',
    colValue: 'Nilai {currency}',
    colActions: 'Tindakan',
    actionDeposit: 'Deposit',
    actionWithdraw: 'Tarik',
    actionTrade: 'Trade',
    noMatchingAssets: 'Tidak ada aset yang cocok',
    emptyFilterHideSmall:
      '“Sembunyikan saldo kecil” menyembunyikan baris di bawah {amount}. Matikan opsi ini atau cari berdasarkan simbol.',
    emptyFilterSearch: 'Coba kata kunci lain atau hapus filter.',
    emptyFilterAdjust: 'Sesuaikan filter untuk melihat lebih banyak baris.',
    emptyTitle: 'Belum ada saldo spot',
    emptyDescription: 'Transfer dari Funding ke Spot saat siap trading, atau deposit terlebih dahulu.',
    emptyAction: 'Ringkasan aset',
    showingRange: 'Menampilkan {start}–{end} dari {total}',
    portfolioTotal: 'Total portofolio:',
    previous: 'Sebelumnya',
    next: 'Berikutnya',
    pageOf: 'Halaman {page} dari {pages}',
  },
};

function readJson(locale, file) {
  return JSON.parse(fs.readFileSync(path.join(root, locale, file), 'utf8'));
}

function writeJson(locale, file, data) {
  fs.writeFileSync(path.join(root, locale, file), JSON.stringify(data, null, 2) + '\n');
}

for (const locale of ['en', 'zh-CN', 'id-ID']) {
  const wallet = readJson(locale, 'wallet.json');
  wallet.spotWalletPage = spotWalletPage[locale === 'en' ? 'en' : locale];
  writeJson(locale, 'wallet.json', wallet);
}

console.log('wallet spotWalletPage merged');

for (const locale of ['en', 'zh-CN', 'id-ID']) {
  const account = readJson(locale, 'account.json');
  Object.assign(account, accountSections(locale));
  writeJson(locale, 'account.json', account);
}

console.log('account dashboard sections merged');
