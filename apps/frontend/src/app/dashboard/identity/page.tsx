'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/auth';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ROUTES } from '@/lib/routes';
import {
  Globe,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Building2,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';

interface Country {
  code: string;
  name: string;
  flag: string;
}

interface DocumentType {
  id: string;
  name: string;
  icon: string;
  recommended?: boolean;
  description?: string;
}

const countries: Country[] = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
];

const documentTypes: Record<string, DocumentType[]> = {
  'IN': [
    { id: 'aadhaar', name: 'Aadhaar', icon: '🪪', recommended: true },
    { id: 'pan', name: 'PAN Card', icon: '💳' },
    { id: 'passport', name: 'Passport', icon: '📕' },
    { id: 'driving_license', name: 'Driving License', icon: '🚗' },
    { id: 'voter_id', name: 'Voter ID', icon: '🗳️' },
  ],
  'default': [
    { id: 'passport', name: 'Passport', icon: '📕', recommended: true },
    { id: 'national_id', name: 'National ID Card', icon: '🪪' },
    { id: 'driving_license', name: 'Driving License', icon: '🚗' },
  ],
};

export default function IdentityVerificationPage() {
  const t = useTranslations('account.identityPage');
  const tc = useTranslations('account.common');
  const { fromApi } = useApiErrorMessage();
  const router = useRouter();
  const { accessToken, _hasHydrated } = useAuthStore();

  const countryName = useCallback(
    (code: string) => {
      try {
        return t(`countries.${code}` as Parameters<typeof t>[0]);
      } catch {
        return code;
      }
    },
    [t],
  );

  const documentTypeName = useCallback(
    (id: string) => {
      try {
        return t(`documentTypes.${id}` as Parameters<typeof t>[0]);
      } catch {
        return id;
      }
    },
    [t],
  );
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  const [showOtherDocuments, setShowOtherDocuments] = useState(false);
  const [showDigiLocker, setShowDigiLocker] = useState(false);
  const [digiLockerConsent, setDigiLockerConsent] = useState({
    aadhaar: true,
    drivingLicense: false,
    pan: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [kycLevel, setKycLevel] = useState<number>(0);
  const [checkingKyc, setCheckingKyc] = useState(true);

  const API_URL = getApiBaseUrl();

  // Check KYC status on mount
  useEffect(() => {
    const checkKycStatus = async () => {
      if (!_hasHydrated || !accessToken) return;
      
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/profile`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await response.json();
        
        if (result.success && result.data?.user) {
          setKycStatus(result.data.user.kycStatus || 'not_submitted');
          setKycLevel(result.data.user.kycLevel || 0);
        }
      } catch (err) {
        console.error('Failed to check KYC status:', err);
      } finally {
        setCheckingKyc(false);
      }
    };
    
    checkKycStatus();
  }, [accessToken, _hasHydrated]);

  const availableDocuments = documentTypes[selectedCountry.code] || documentTypes['default'];
  const quickVerification = availableDocuments.find(d => d.recommended);
  const otherDocuments = availableDocuments.filter(d => !d.recommended);

  const handleVerifyClick = () => {
    if (selectedCountry.code === 'IN' && (selectedDocument === 'aadhaar' || !selectedDocument)) {
      setShowDigiLocker(true);
    } else {
      // Proceed to document upload
      router.push(`/dashboard/identity/upload?doc=${selectedDocument || quickVerification?.id}`);
    }
  };

  const handleDigiLockerContinue = async () => {
    setLoading(true);
    setError('');

    try {
      // Simulate DigiLocker verification
      const response = await fetch(`${API_URL}/api/v1/kyc/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          country: selectedCountry.code,
          documentType: selectedDocument || 'aadhaar',
          provider: 'digilocker',
          consent: digiLockerConsent,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/dashboard/identity/upload');
      } else {
        setError(fromApi(data, 'generic.unknown') || t('verificationFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? fromApi({ message: err.message }) : t('verificationFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking KYC
  if (checkingKyc) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('checkingStatus')}</p>
        </div>
      </div>
    );
  }

  // Show verified state if KYC is approved
  if (kycStatus === 'approved') {
    return (
      <div className="min-h-screen bg-card">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} />
            <span className="text-muted-foreground">|</span>
            <h1 className="text-xl font-semibold text-foreground">{t('headerTitle')}</h1>
          </div>
        </header>

        {/* Verified Content */}
        <main className="max-w-2xl mx-auto px-6 py-12">
          <div className="bg-card rounded-xl p-8 shadow-sm border border-border text-center">
            <div className="w-20 h-20 bg-buy-light rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-buy" />
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t('verifiedTitle')}
            </h2>
            
            <p className="text-muted-foreground mb-6">
              {t('verifiedSubtitle')}
            </p>

            <div className="bg-muted rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted-foreground">{t('verificationLevel')}</span>
                <span className="font-semibold text-foreground">{t('levelLabel', { level: kycLevel })}</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted-foreground">{t('statusLabel')}</span>
                <span className="flex items-center gap-2 text-buy font-semibold">
                  <span className="w-2 h-2 bg-buy rounded-full"></span>
                  {t('statusVerified')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('dailyWithdrawalLimit')}</span>
                <span className="font-semibold text-foreground">{t('unlimited')}</span>
              </div>
            </div>

            <Link
              href="/dashboard/account"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/85 text-primary-foreground font-semibold rounded-xl transition-colors"
            >
              {t('goToAccount')}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 text-center text-sm text-muted-foreground">
          <p>{t('footerCopyright')}</p>
        </footer>
      </div>
    );
  }

  // Show pending state if KYC is pending
  if (kycStatus === 'pending') {
    return (
      <div className="min-h-screen bg-card">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} />
            <span className="text-muted-foreground">|</span>
            <h1 className="text-xl font-semibold text-foreground">{t('headerTitle')}</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-12">
          <div className="bg-card rounded-xl p-8 shadow-sm border border-border text-center">
            <div className="w-20 h-20 bg-warning-light rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-warning" />
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t('pendingTitle')}
            </h2>
            
            <p className="text-muted-foreground mb-6">
              {t('pendingSubtitle')}
            </p>

            <Link
              href="/dashboard/account"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent text-foreground/80 font-semibold rounded-xl transition-colors"
            >
              {t('goToAccount')}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-card">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} />
          <span className="text-muted-foreground">|</span>
          <h1 className="text-xl font-semibold text-foreground">{t('headerTitle')}</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/help"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Building2 className="w-4 h-4" />
            {t('businessVerification')}
          </Link>
          <Link href="/dashboard/support" className="p-2 text-muted-foreground hover:text-foreground" aria-label={t('helpAria')}>
            <HelpCircle className="w-5 h-5" />
          </Link>
          <Link href="/dashboard/account" className="p-2 text-muted-foreground hover:text-foreground" aria-label={t('accountAria')}>
            <Globe className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        <p className="mb-4 text-sm text-muted-foreground">{t('accountWideNote')}</p>
        <div className="bg-card rounded-xl p-8 shadow-sm border border-border">
          <h2 className="text-2xl font-bold text-foreground mb-8">
            {t('proofTitle')}
          </h2>

          {/* Country Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              {t('countryLabel')}
            </label>
            <div className="relative">
              <button
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted border border-border rounded-xl text-left hover:border-muted-foreground/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedCountry.flag}</span>
                  <span className="text-foreground font-medium">{countryName(selectedCountry.code)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">{t('location')}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {showCountryDropdown && (
                <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {countries.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => {
                        setSelectedCountry(country);
                        setShowCountryDropdown(false);
                        setSelectedDocument('');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
                    >
                      <span className="text-xl">{country.flag}</span>
                      <span className="text-foreground">{countryName(country.code)}</span>
                      {selectedCountry.code === country.code && (
                        <Check className="w-4 h-4 text-buy ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Warning for India */}
          {selectedCountry.code === 'IN' && (
            <div className="mb-6 p-4 bg-muted rounded-xl text-sm text-muted-foreground">
              {t('indiaWarning')}
            </div>
          )}

          {/* Quick Verification */}
          {quickVerification && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-foreground/80 mb-3">
                {t('quickVerification')}
              </h3>
              <button
                onClick={() => setSelectedDocument(quickVerification.id)}
                className={`w-full flex items-center gap-4 px-4 py-4 border-2 rounded-xl transition-colors ${
                  selectedDocument === quickVerification.id || !selectedDocument
                    ? 'border-primary bg-muted'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
                  <span className="text-2xl">{quickVerification.icon}</span>
                </div>
                <span className="text-foreground font-medium flex-1 text-left">
                  {documentTypeName(quickVerification.id)}
                </span>
                <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                  {t('recommended')}
                </span>
              </button>
            </div>
          )}

          {/* Other Documents */}
          <div className="mb-8">
            <button
              onClick={() => setShowOtherDocuments(!showOtherDocuments)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              {t('otherDocuments', {
                doc: quickVerification ? documentTypeName(quickVerification.id) : '',
              })}
              <ChevronDown className={`w-4 h-4 transition-transform ${showOtherDocuments ? 'rotate-180' : ''}`} />
            </button>

            {showOtherDocuments && (
              <div className="mt-4 space-y-3">
                {otherDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocument(doc.id)}
                    className={`w-full flex items-center gap-4 px-4 py-3 border-2 rounded-xl transition-colors ${
                      selectedDocument === doc.id
                        ? 'border-primary bg-muted'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <span className="text-xl">{doc.icon}</span>
                    <span className="text-foreground">{documentTypeName(doc.id)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-sell-light border border-sell/20 rounded-xl flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handleVerifyClick}
            disabled={loading}
            className="w-full py-4 bg-primary hover:bg-primary/85 text-primary-foreground font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span className="text-xl">🎁</span>
            {t('verifyToEarn')}
          </button>

          {/* App Link */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              {t('continueOnApp')}{' '}
              <Link href="/dashboard/help" className="text-foreground font-medium hover:underline inline-flex items-center gap-1">
                {t('fdmApp')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>{t('footerCopyright')}</p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <Link href="/terms" className="hover:text-foreground">{t('termsOfService')}</Link>
          <Link href="/privacy" className="hover:text-foreground">{t('privacyPolicy')}</Link>
        </div>
      </footer>

      {/* DigiLocker Modal */}
      {showDigiLocker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-end p-4">
              <button
                onClick={() => setShowDigiLocker(false)}
                className="p-1 hover:bg-accent rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-8 pb-8">
              <h2 className="text-xl font-bold text-foreground text-center mb-2">
                {t('digilockerTitle')}
              </h2>
              <p className="text-muted-foreground text-center text-sm mb-6">
                {t('digilockerSubtitle')}
              </p>

              {/* DigiLocker Card */}
              <div className="border border-border rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-10 bg-primary rounded flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-sm">{t('digilockerBrand')}</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-buy rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-primary-foreground" />
                  </div>
                </div>

                <p className="text-muted-foreground text-sm mb-4">
                  {t('digilockerConsent', { brand: 'FDM' })}
                </p>

                {/* Documents List */}
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground/80 font-medium">{t('issuedDocuments')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDigiLockerConsent({ aadhaar: true, drivingLicense: true, pan: true })}
                      className="text-primary text-sm font-medium"
                    >
                      {t('selectAll')}
                    </button>
                  </div>
                  
                  <div className="divide-y divide-border">
                    <label className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent">
                      <span className="text-foreground">{t('aadhaarCard')}</span>
                      <input
                        type="checkbox"
                        checked={digiLockerConsent.aadhaar}
                        onChange={(e) => setDigiLockerConsent({ ...digiLockerConsent, aadhaar: e.target.checked })}
                        className="w-5 h-5 text-buy rounded border-border focus:ring-buy/30"
                      />
                    </label>
                    <label className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent">
                      <div>
                        <span className="text-foreground">{t('drivingLicense')}</span>
                        <span className="text-muted-foreground text-sm ml-2">{t('canBeAccessed')}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={digiLockerConsent.drivingLicense}
                        onChange={(e) => setDigiLockerConsent({ ...digiLockerConsent, drivingLicense: e.target.checked })}
                        className="w-5 h-5 text-buy rounded border-border focus:ring-buy/30"
                      />
                    </label>
                    <label className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent">
                      <span className="text-foreground">{t('panVerificationRecord')}</span>
                      <input
                        type="checkbox"
                        checked={digiLockerConsent.pan}
                        onChange={(e) => setDigiLockerConsent({ ...digiLockerConsent, pan: e.target.checked })}
                        className="w-5 h-5 text-buy rounded border-border focus:ring-buy/30"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Continue Button */}
              <button
                onClick={handleDigiLockerContinue}
                disabled={loading || (!digiLockerConsent.aadhaar && !digiLockerConsent.pan)}
                className="w-full py-4 bg-primary hover:bg-primary/85 text-primary-foreground font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('verifying') : tc('continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Button */}
      <Link
        href="/dashboard/support"
        className="fixed bottom-6 right-6 w-12 h-12 bg-primary hover:bg-primary/85 text-primary-foreground rounded-full shadow-lg flex items-center justify-center transition-colors z-40"
        aria-label={t('getHelpAria')}
      >
        <HelpCircle className="w-6 h-6" />
      </Link>
    </div>
  );
}
