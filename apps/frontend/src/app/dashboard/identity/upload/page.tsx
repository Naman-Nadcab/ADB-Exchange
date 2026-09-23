'use client';

import { useState, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/auth';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import Link from 'next/link';
import {
  Upload,
  Camera,
  X,
  ChevronLeft,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react';

function DocumentUploadContent() {
  const tu = useTranslations('account.identityUploadPage');
  const tDoc = useTranslations('account.identityPage.documentTypes');
  const { fromApi } = useApiErrorMessage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken } = useAuthStore();

  const documentLabel = useCallback(
    (type: string) => {
      try {
        return tDoc(type as Parameters<typeof tDoc>[0]);
      } catch {
        return tu('documentFallback');
      }
    },
    [tDoc, tu],
  );
  
  const documentType = searchParams.get('doc') || 'passport';
  const documentName = documentLabel(documentType);
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'front' | 'back' | 'selfie' | 'review'>('front');

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const API_URL = getApiBaseUrl();

  const needsBackImage = ['aadhaar', 'national_id', 'driving_license', 'voter_id'].includes(documentType);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back' | 'selfie') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setError(tu('invalidImage'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(tu('fileTooLarge'));
      return;
    }

    setError('');
    const preview = URL.createObjectURL(file);

    switch (type) {
      case 'front':
        setFrontImage(file);
        setFrontPreview(preview);
        if (needsBackImage) {
          setStep('back');
        } else {
          setStep('selfie');
        }
        break;
      case 'back':
        setBackImage(file);
        setBackPreview(preview);
        setStep('selfie');
        break;
      case 'selfie':
        setSelfie(file);
        setSelfiePreview(preview);
        setStep('review');
        break;
    }
  };

  const handleSubmit = async () => {
    if (!frontImage || !selfie) {
      setError(tu('missingRequired'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('documentType', documentType);
      formData.append('frontImage', frontImage);
      if (backImage) {
        formData.append('backImage', backImage);
      }
      formData.append('selfie', selfie);

      const response = await fetch(`${API_URL}/api/v1/kyc/upload-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        router.push('/dashboard/identity/success');
      } else {
        setError(fromApi(data, 'generic.unknown') || tu('uploadFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? fromApi({ message: err.message }) : tu('uploadFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted dark:bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {tu('uploadDocument', { document: documentName })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tu('stepOf', {
                current: ['front', 'back', 'selfie', 'review'].indexOf(step) + 1,
                total: needsBackImage ? 4 : 3,
              })}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
          
          {/* Progress Bar */}
          <div className="flex gap-2 mb-8">
            {['front', ...(needsBackImage ? ['back'] : []), 'selfie', 'review'].map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full ${
                  ['front', ...(needsBackImage ? ['back'] : []), 'selfie', 'review'].indexOf(step) >= i
                    ? 'bg-primary'
                    : 'bg-accent'
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-sell-light border border-sell/20 rounded-xl flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Front Image Upload */}
          {step === 'front' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {tu('frontTitle')}
                </h2>
                <p className="text-muted-foreground">
                  {tu('frontHint', { document: documentName })}
                </p>
              </div>

              <div
                onClick={() => frontInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {frontPreview ? (
                  <div className="relative">
                    <img src={frontPreview} alt={tu('altFront')} className="max-h-64 mx-auto rounded-lg" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFrontImage(null);
                        setFrontPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-sell text-destructive-foreground rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{tu('clickUpload')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{tu('fileTypes')}</p>
                  </>
                )}
              </div>
              <input
                ref={frontInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'front')}
                className="hidden"
              />

              <button
                onClick={() => frontInputRef.current?.click()}
                className="w-full py-3 bg-accent hover:bg-accent text-foreground font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                {tu('takePhoto')}
              </button>
            </div>
          )}

          {/* Back Image Upload */}
          {step === 'back' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {tu('backTitle')}
                </h2>
                <p className="text-muted-foreground">
                  {tu('backHint', { document: documentName })}
                </p>
              </div>

              <div
                onClick={() => backInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {backPreview ? (
                  <div className="relative">
                    <img src={backPreview} alt={tu('altBack')} className="max-h-64 mx-auto rounded-lg" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBackImage(null);
                        setBackPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-sell text-destructive-foreground rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{tu('clickUpload')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{tu('fileTypes')}</p>
                  </>
                )}
              </div>
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'back')}
                className="hidden"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('front')}
                  className="flex-1 py-3 bg-accent hover:bg-accent text-foreground font-medium rounded-xl transition-colors"
                >
                  {tu('back')}
                </button>
                <button
                  onClick={() => backInputRef.current?.click()}
                  className="flex-1 py-3 bg-primary hover:bg-primary/85 text-primary-foreground font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  {tu('takePhoto')}
                </button>
              </div>
            </div>
          )}

          {/* Selfie Upload */}
          {step === 'selfie' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {tu('selfieTitle')}
                </h2>
                <p className="text-muted-foreground">
                  {tu('selfieHint', { document: documentName })}
                </p>
              </div>

              <div
                onClick={() => selfieInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {selfiePreview ? (
                  <div className="relative">
                    <img src={selfiePreview} alt={tu('altSelfie')} className="max-h-64 mx-auto rounded-lg" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelfie(null);
                        setSelfiePreview(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-sell text-destructive-foreground rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-24 h-24 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                      <Camera className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">{tu('clickSelfie')}</p>
                  </>
                )}
              </div>
              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => handleFileSelect(e, 'selfie')}
                className="hidden"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(needsBackImage ? 'back' : 'front')}
                  className="flex-1 py-3 bg-accent hover:bg-accent text-foreground font-medium rounded-xl transition-colors"
                >
                  {tu('back')}
                </button>
                <button
                  onClick={() => selfieInputRef.current?.click()}
                  className="flex-1 py-3 bg-primary hover:bg-primary/85 text-primary-foreground font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  {tu('takeSelfie')}
                </button>
              </div>
            </div>
          )}

          {/* Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {tu('reviewTitle')}
                </h2>
                <p className="text-muted-foreground">
                  {tu('reviewHint')}
                </p>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                  {frontPreview && (
                    <img src={frontPreview} alt="Front" className="w-20 h-14 object-cover rounded-lg" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{tu('frontSide')}</p>
                    <p className="text-sm text-buy flex items-center gap-1">
                      <Check className="w-4 h-4" /> {tu('uploaded')}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep('front')}
                    className="text-primary text-sm hover:underline"
                  >
                    {tu('change')}
                  </button>
                </div>

                {needsBackImage && backPreview && (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                    <img src={backPreview} alt={tu('altBack')} className="w-20 h-14 object-cover rounded-lg" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{tu('backSide')}</p>
                      <p className="text-sm text-buy flex items-center gap-1">
                        <Check className="w-4 h-4" /> {tu('uploaded')}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep('back')}
                      className="text-primary text-sm hover:underline"
                    >
                      {tu('change')}
                    </button>
                  </div>
                )}

                {selfiePreview && (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                    <img src={selfiePreview} alt={tu('altSelfie')} className="w-20 h-20 object-cover rounded-full" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{tu('selfie')}</p>
                      <p className="text-sm text-buy flex items-center gap-1">
                        <Check className="w-4 h-4" /> {tu('uploaded')}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep('selfie')}
                      className="text-primary text-sm hover:underline"
                    >
                      {tu('change')}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('selfie')}
                  className="flex-1 py-3 bg-accent hover:bg-accent text-foreground font-medium rounded-xl transition-colors"
                >
                  {tu('back')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-primary hover:bg-primary/85 text-primary-foreground font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {tu('uploading')}
                    </>
                  ) : (
                    tu('submit')
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-6 p-4 bg-muted border border-border rounded-xl">
          <h3 className="font-medium text-foreground mb-2">{tu('tipsTitle')}</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• {tu('tip1')}</li>
            <li>• {tu('tip2')}</li>
            <li>• {tu('tip3')}</li>
            <li>• {tu('tip4')}</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default function DocumentUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted dark:bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <DocumentUploadContent />
    </Suspense>
  );
}
