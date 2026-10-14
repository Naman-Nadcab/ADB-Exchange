'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Check,
  Edit3,
  User,
  Users,
  Shield,
  Monitor,
  Activity,
  Trash2,
  ChevronRight,
  ShieldAlert,
  Camera,
  Verified,
  AlertTriangle,
  Settings,
  Link2,
  Smartphone,
  Building2,
  Loader2,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { walletPath } from '@/lib/routes';
import { toast } from '@/components/ui/toaster';

interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  totp_enabled: boolean;
  sms_auth_enabled: boolean;
  passkeys_enabled: boolean;
  has_fund_password: boolean;
  kycStatus: string;
  kycLevel: number;
  passkeysCount: number;
  activeDevices: number;
  last_login_at: string | null;
  created_at: string;
}

export default function AccountInfoPage() {
  const ta = useTranslations('account');
  const tCommon = useTranslations('common');
  const tn = useTranslations('common.notifications');
  const tt = useTranslations('account.toasts');
  const router = useRouter();
  const { user, accessToken, _hasHydrated, updateUser } = useAuthStore();
  const [copiedUID, setCopiedUID] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [delete2fa, setDelete2fa] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(null);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);

  const apiUrl = getApiBaseUrl();

  // Fetch comprehensive profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!_hasHydrated || !accessToken) return;
      
      try {
        const response = await fetch(`${apiUrl}/api/v1/auth/profile`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await response.json();
        if (result.success) {
          setProfileData(result.data.user);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [accessToken, _hasHydrated]);

  useEffect(() => {
    const fetchDeletionStatus = async () => {
      if (!_hasHydrated || !accessToken) return;
      try {
        const res = await fetch(`${apiUrl}/api/v1/auth/account/deletion-status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (json.success && json.data?.requested) {
          setDeletionScheduledAt(json.data.scheduledAt || null);
        } else {
          setDeletionScheduledAt(null);
        }
      } catch {
        /* non-blocking */
      }
    };
    fetchDeletionStatus();
  }, [accessToken, _hasHydrated]);

  const fetchLinkedProviders = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/account/linked-providers`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setLinkedProviders((json.data?.providers || []).map((p: { provider: string }) => p.provider));
      }
    } catch {
      /* non-blocking */
    }
  };

  useEffect(() => {
    if (!_hasHydrated || !accessToken) return;
    fetchLinkedProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, _hasHydrated]);

  const googleLinked = linkedProviders.includes('google');

  const startGoogleLink = async () => {
    if (linking || !accessToken) return;
    setLinking(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/oauth/google/link-url`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        window.location.href = json.data.url;
      } else {
        toast({ title: tt('cannotLinkGoogle'), description: json.error?.message || tt('googleNotConfigured'), variant: 'destructive' });
        setLinking(false);
      }
    } catch {
      toast({ title: tn('errorTitle'), description: tt('googleLinkStartFailed'), variant: 'destructive' });
      setLinking(false);
    }
  };

  const unlinkGoogle = async () => {
    if (!accessToken) return;
    setLinking(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/account/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ provider: 'google' }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: tt('googleUnlinked'), variant: 'success' });
        await fetchLinkedProviders();
      } else {
        toast({ title: tt('cannotUnlink'), description: json.error?.message || tt('googleUnlinkFailed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tn('errorTitle'), description: tt('googleUnlinkError'), variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  const submitAccountDeletion = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/account/deletion-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ password: deletePassword, twoFactorCode: delete2fa || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setDeletionScheduledAt(json.data?.scheduledAt || null);
        setShowDeleteModal(false);
        setDeletePassword('');
        setDelete2fa('');
        toast({
          title: tt('scheduledDeletionTitle'),
          description: tt('scheduledDeletionDesc'),
          variant: 'default',
        });
      } else {
        toast({ title: tt('couldNotRequestDeletion'), description: json.error?.message || tt('pleaseTryAgain'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tn('errorTitle'), description: tt('deletionRequestFailed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const cancelAccountDeletion = async () => {
    if (cancellingDeletion) return;
    setCancellingDeletion(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/account/deletion-request/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setDeletionScheduledAt(null);
        toast({ title: tt('deletionCancelledTitle'), description: tt('deletionCancelledDesc'), variant: 'success' });
      } else {
        toast({ title: tn('errorTitle'), description: json.error?.message || tt('cancelDeletionFailed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tn('errorTitle'), description: tt('cancelDeletionError'), variant: 'destructive' });
    } finally {
      setCancellingDeletion(false);
    }
  };

  // Calculate security level based on actual settings
  const calculateSecurityLevel = () => {
    if (!profileData) return { score: 0, status: 'Low', color: 'orange' };
    
    let score = 0;
    if (profileData.email) score += 15; // Email verified
    if (profileData.phone) score += 15; // Phone linked
    if (profileData.sms_auth_enabled) score += 10; // SMS auth enabled
    if (profileData.totp_enabled) score += 25; // 2FA enabled
    if (profileData.passkeysCount > 0) score += 15; // Passkeys enabled
    if (profileData.has_fund_password) score += 10; // Fund password set
    if (profileData.kycStatus === 'approved') score += 10; // KYC verified
    
    if (score >= 80) return { score, status: 'High', color: 'green' };
    if (score >= 50) return { score, status: 'Medium', color: 'yellow' };
    return { score, status: 'Low', color: 'orange' };
  };

  const security = calculateSecurityLevel();

  const getKycStatusDisplay = () => {
    if (!profileData) return { text: ta('common.loading'), color: 'gray', icon: Clock };
    switch (profileData.kycStatus) {
      case 'approved':
        return { text: ta('verification.verified'), color: 'green', icon: CheckCircle };
      case 'pending':
        return { text: ta('verification.pending'), color: 'yellow', icon: Clock };
      case 'rejected':
        return { text: ta('verification.rejected'), color: 'red', icon: AlertTriangle };
      default:
        return { text: ta('verification.unverified'), color: 'gray', icon: AlertTriangle };
    }
  };

  const securityLevelLabel = (status: string) => {
    if (status === 'High') return ta('security.level.high');
    if (status === 'Medium') return ta('security.level.medium');
    return ta('security.level.low');
  };

  const kycDisplay = getKycStatusDisplay();

  const maskEmail = (email: string | null | undefined) => {
    if (email == null || email.trim() === '' || email.toLowerCase() === 'null' || email.toLowerCase() === 'undefined') return tCommon('states.notAdded');
    const [local, domain] = email.split('@');
    if (!domain) return '***@****';
    const maskedLocal = local.slice(0, 3) + '***';
    return `${maskedLocal}@${domain}`;
  };

  const copyUID = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedUID(true);
      setTimeout(() => setCopiedUID(false), 2000);
    }
  };

  const formatDate = (date?: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) e.target.value = '';
    if (!file || !accessToken) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: tt('imageTooLargeTitle'), description: tt('imageTooLargeDesc'), variant: 'destructive' });
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiUrl}/api/v1/user/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.avatarUrl) {
        updateUser({ avatarUrl: json.data.avatarUrl });
        toast({ title: tt('profilePictureUpdated'), variant: 'success' });
      } else {
        toast({ title: tt('uploadFailedTitle'), description: json.error?.message || tt('profilePictureUpdateFailed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tn('errorTitle'), description: tt('profilePictureUploadFailed'), variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const SettingRow = ({ icon: Icon, title, description, status, statusColor, action, actionLabel, actionVariant = 'default', badge }: {
    icon: React.ElementType;
    title: string;
    description?: string;
    status?: string;
    statusColor?: string;
    action?: () => void;
    actionLabel: string;
    actionVariant?: 'default' | 'primary' | 'success';
    badge?: string;
  }) => (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {badge && (
          <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-medium rounded-md">{badge}</span>
        )}
        {status && (
          <span className={`flex items-center gap-1.5 text-sm font-medium ${statusColor}`}>
            <span className={`w-2 h-2 rounded-full ${statusColor?.includes('text-buy') ? 'bg-buy' : statusColor?.includes('text-warning') ? 'bg-warning' : 'bg-muted-foreground'}`}></span>
            {status}
          </span>
        )}
        <button
          onClick={action}
          disabled={!action}
          className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
            !action ? 'opacity-50 cursor-not-allowed ' : ''
          }${
            actionVariant === 'primary'
              ? 'bg-primary hover:bg-primary/85 text-primary-foreground shadow-lg shadow-blue-500/25'
              : actionVariant === 'success'
              ? 'bg-buy hover:bg-buy-hover text-primary-foreground shadow-lg shadow-buy/25'
              : 'bg-accent hover:bg-accent text-foreground/80'
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-background">
      <div>
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-xl font-semibold text-foreground">{ta('profile.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ta('profile.subtitle')}</p>
        </div>

        {/* User Profile Card */}
        <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
          <div className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              {/* Left: Avatar and Info */}
              <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className="relative group">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt={ta('profile.avatarAlt')} className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-primary-foreground" />
                    )}
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label={ta('profile.changeAvatarAria')}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary hover:bg-primary/85 rounded-xl flex items-center justify-center transition-colors shadow-lg disabled:opacity-60"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-primary-foreground" />
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleAvatarSelected}
                  />
                </div>

                {/* User Details */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl font-bold text-foreground">
                      {maskEmail(user?.email || '')}
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/security')}
                      className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                      aria-label={ta('profile.changeEmailAria')}
                    >
                      <Edit3 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    {/* UID */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">UID:</span>
                      <span className="font-mono font-medium text-foreground bg-accent px-2 py-1 rounded-lg text-sm">
                        {user?.id?.slice(0, 9) || '********'}
                      </span>
                      <button
                        onClick={copyUID}
                        className="p-1 hover:bg-accent rounded-lg transition-colors"
                      >
                        {copiedUID ? (
                          <Check className="w-4 h-4 text-buy" />
                        ) : (
                          <Copy className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>

                    {/* Last Login */}
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{ta('profile.lastLogin')}</span>
                      <span className="text-sm text-foreground">
                        {loading ? ta('common.loading') : formatDate(profileData?.last_login_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Security Alert - Dynamic based on security level */}
              {security.status !== 'High' ? (
                <div className="flex items-start gap-4 p-4 bg-warning-light border border-warning/30 rounded-xl max-w-sm">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                    <ShieldAlert className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">{ta('profile.securityAlert')}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {security.status === 'Low' 
                        ? ta('profile.securityLow') 
                        : ta('profile.securityImprove')}
                    </p>
                    <Link 
                      href="/dashboard/security"
                      className="text-sm text-primary hover:text-primary/85 font-medium flex items-center gap-1"
                    >
                      {!profileData?.totp_enabled ? ta('profile.setup2fa') : ta('profile.improveSecurity')} <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4 p-4 bg-buy-light border border-buy/20 rounded-xl max-w-sm">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-buy" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">{ta('profile.accountSecured')}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {ta('profile.accountSecuredDesc')}
                    </p>
                    <Link 
                      href="/dashboard/security"
                      className="text-sm text-buy hover:text-buy/90 font-medium flex items-center gap-1"
                    >
                      {ta('profile.viewSettings')} <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security Level Bar */}
          <div className="border-t border-border bg-muted px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground/80">{ta('profile.securityLevel')}</span>
              <span className={`text-sm font-semibold ${
                security.color === 'green' ? 'text-buy' : 
                security.color === 'yellow' ? 'text-warning' : 'text-warning'
              }`}>{securityLevelLabel(security.status)}</span>
            </div>
            <div className="w-full bg-accent rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  security.color === 'green' ? 'bg-gradient-to-r from-buy to-buy/80' : 
                  security.color === 'yellow' ? 'bg-gradient-to-r from-warning to-warning/80' : 
                  'bg-gradient-to-r from-warning to-warning/70'
                }`} 
                style={{ width: `${security.score}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-lg font-semibold text-foreground">{ta('profile.profileSettings')}</h2>
          </div>
          <div className="divide-y divide-border">
            <SettingRow
              icon={Camera}
              title={ta('profile.profilePicture')}
              description={ta('profile.profilePictureDesc')}
              status={user?.avatarUrl ? ta('common.set') : ta('common.notSet')}
              statusColor={user?.avatarUrl ? 'text-buy' : 'text-muted-foreground'}
              actionLabel={uploadingAvatar ? ta('common.uploading') : ta('common.upload')}
              actionVariant="primary"
              action={() => avatarInputRef.current?.click()}
            />
            <SettingRow
              icon={Users}
              title={ta('profile.affiliateCommunity')}
              description={ta('profile.affiliateCommunityDesc')}
              actionLabel={ta('common.join')}
              actionVariant="success"
              action={() => router.push('/dashboard/referral')}
            />
            <SettingRow
              icon={Shield}
              title={ta('profile.identityVerification')}
              description={ta('profile.identityVerificationDesc')}
              status={kycDisplay.text}
              statusColor={
                kycDisplay.color === 'green' ? 'text-buy' : 
                kycDisplay.color === 'yellow' ? 'text-warning' : 
                kycDisplay.color === 'red' ? 'text-sell' : 'text-muted-foreground'
              }
              actionLabel={profileData?.kycStatus === 'approved' ? ta('common.view') : ta('common.verifyNow')}
              actionVariant={profileData?.kycStatus === 'approved' ? 'default' : 'primary'}
              action={() => window.location.href = '/dashboard/identity'}
            />
            <SettingRow
              icon={Building2}
              title={ta('profile.bankUpi')}
              description={ta('profile.bankUpiDesc')}
              actionLabel={ta('common.manage')}
              actionVariant="primary"
              action={() => { window.location.href = walletPath.paymentMethods; }}
            />
          </div>
        </div>

        {/* Account Integrations */}
        <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
          <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{ta('profile.integrationsTitle')}</h2>
              <p className="text-sm text-muted-foreground">{ta('profile.integrationsSubtitle')}</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            <SettingRow
              icon={Smartphone}
              title={ta('profile.linkGoogle')}
              description={ta('profile.linkGoogleDesc')}
              status={googleLinked ? ta('common.linked') : ta('common.notLinked')}
              statusColor={googleLinked ? 'text-buy' : 'text-muted-foreground'}
              actionLabel={linking ? ta('common.pleaseWait') : googleLinked ? ta('common.unlink') : ta('common.link')}
              actionVariant={googleLinked ? 'default' : 'primary'}
              action={() => (googleLinked ? void unlinkGoogle() : void startGoogleLink())}
            />
          </div>
        </div>

        {/* Account Activities */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{ta('profile.activitiesTitle')}</h2>
              <p className="text-sm text-muted-foreground">{ta('profile.activitiesSubtitle')}</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            <SettingRow
              icon={Monitor}
              title={ta('profile.trustedDevices')}
              description={
                loading
                  ? ta('common.loading')
                  : ta('profile.trustedDevicesDesc', { count: profileData?.activeDevices || 1 })
              }
              actionLabel={ta('common.manage')}
              action={() => { window.location.href = '/dashboard/security/sessions'; }}
            />
            <SettingRow
              icon={Activity}
              title={ta('profile.loginHistory')}
              description={ta('profile.loginHistoryDesc')}
              actionLabel={ta('common.view')}
              action={() => { window.location.href = '/dashboard/account/login-history'; }}
            />
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sell-light">
                  <Trash2 className="h-4 w-4 text-sell" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{ta('profile.deleteAccount')}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {deletionScheduledAt
                      ? ta('profile.deleteScheduled', { date: formatDate(deletionScheduledAt) })
                      : ta('profile.deleteAccountDesc')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {deletionScheduledAt ? (
                  <button
                    onClick={() => void cancelAccountDeletion()}
                    disabled={cancellingDeletion}
                    className="px-5 py-2.5 text-sm font-medium rounded-xl bg-accent hover:bg-accent/70 text-foreground transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {cancellingDeletion && <Loader2 className="w-4 h-4 animate-spin" />}
                    {ta('common.cancelDeletion')}
                  </button>
                ) : (
                  <button onClick={() => setShowDeleteModal(true)} className="px-5 py-2.5 text-sm font-medium rounded-xl bg-sell-light hover:bg-sell/20 text-destructive transition-colors">
                    {ta('common.delete')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{ta('profile.deleteModalTitle')}</h2>
              <button onClick={() => setShowDeleteModal(false)} className="p-2 hover:bg-accent rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-sell-light border border-sell/30 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-sell flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/90">
                  {ta.rich('profile.deleteWarning', {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{ta('profile.deletePasswordLabel')}</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sell"
                  placeholder={ta('profile.deletePasswordPlaceholder')}
                  autoComplete="current-password"
                />
              </div>
              {profileData?.totp_enabled && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{ta('common.twoFaCode')}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={delete2fa}
                    onChange={(e) => setDelete2fa(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-sell tracking-widest"
                    placeholder={ta('profile.delete2faPlaceholder')}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-accent">
                {ta('common.cancel')}
              </button>
              <button
                onClick={() => void submitAccountDeletion()}
                disabled={deleting || !deletePassword || (profileData?.totp_enabled && delete2fa.length !== 6)}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-sell hover:bg-sell/85 text-white disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {ta('profile.scheduleDeletion')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
