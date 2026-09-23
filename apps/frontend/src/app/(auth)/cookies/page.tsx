'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function CookiePolicyPage() {
  const t = useTranslations('auth.cookies');
  const tc = useTranslations('common.actions');
  const s2Items = t.raw('s2.items') as string[];

  return (
    <div className="min-h-screen bg-muted dark:bg-background">
      <header className="sticky top-0 z-10 bg-card/80 dark:bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{tc('back')}</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-card rounded-xl border border-border p-8 md:p-12">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t('title')}</h1>
            <p className="text-muted-foreground">{t('lastUpdated')}</p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('s1.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s1.body')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('s2.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s2.intro')}</p>
              <BulletList items={s2Items} />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('s3.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s3.body')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('s4.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('s4.bodyPrefix')}{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  {t('s4.privacyLink')}
                </Link>{' '}
                {t('s4.and')}{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  {t('s4.termsLink')}
                </Link>
                {t('s4.bodySuffix')}
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
