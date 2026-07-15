import { describe, it, expect } from '@jest/globals';
import { linking } from '@app/navigation/linking';

describe('deep link config', () => {
  it('maps auth welcome path', () => {
    expect(linking.config.screens.Auth.screens.Welcome).toBe('auth/welcome');
  });

  it('maps login password alias', () => {
    expect(linking.config.screens.Auth.screens.LoginPassword).toBe('login');
  });

  it('maps oauth callback', () => {
    expect(linking.config.screens.Auth.screens.OAuthCallback).toBe('oauth/callback');
  });

  it('maps account security path', () => {
    expect(linking.config.screens.Account.screens.SecurityCenter).toBe('security');
  });

  it('maps wallet history path', () => {
    expect(linking.config.screens.Main.screens.Wallet.screens.WalletHistory.path).toBe('wallet/history');
  });

  it('maps wallet pnl path', () => {
    expect(linking.config.screens.Main.screens.Wallet.screens.WalletPnl).toBe('wallet/pnl');
  });

  it('maps announcement detail path', () => {
    expect(linking.config.screens.Account.screens.AnnouncementDetail).toBe('announcement/:id');
  });

  it('maps announcements hub path', () => {
    expect(linking.config.screens.Account.screens.Announcements).toBe('dashboard/announcements');
  });

  it('maps deposit coin deep link to network selection', () => {
    expect(linking.config.screens.Main.screens.Wallet.screens.DepositNetwork.path).toBe('wallet/deposit/:symbol');
  });

  it('includes app scheme prefix', () => {
    expect(linking.prefixes).toContain('metheorium://');
  });
});
