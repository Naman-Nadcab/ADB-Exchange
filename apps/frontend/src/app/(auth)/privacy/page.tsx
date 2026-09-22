'use client';
/* eslint-disable react/no-unescaped-entities -- legal prose via i18n */

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

export default function PrivacyPolicyPage() {
  const t = useTranslations('auth.privacy');
  const tc = useTranslations('common.actions');

  const items21 = t.raw('s2.items21') as string[];
  const items22 = t.raw('s2.items22') as string[];
  const items23 = t.raw('s2.items23') as string[];
  const s3Items = t.raw('s3.items') as string[];
  const s4Items = t.raw('s4.items') as string[];
  const s5Items = t.raw('s5.items') as string[];
  const s7Items = t.raw('s7.items') as string[];
  const s8Items = t.raw('s8.items') as string[];

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
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('title')}
            </h1>
            <p className="text-muted-foreground">
              {t('lastUpdated')}
            </p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s1.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s1.body')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s2.title')}</h2>

              <h3 className="text-lg font-medium text-foreground mb-3 mt-6">{t('s2.h21')}</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s2.intro21')}</p>
              <BulletList items={items21} />

              <h3 className="text-lg font-medium text-foreground mb-3 mt-6">{t('s2.h22')}</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s2.intro22')}</p>
              <BulletList items={items22} />

              <h3 className="text-lg font-medium text-foreground mb-3 mt-6">{t('s2.h23')}</h3>
              <BulletList items={items23} />
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s3.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s3.intro')}</p>
              <BulletList items={s3Items} />
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s4.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s4.intro')}</p>
              <BulletList items={s4Items} />
              <p className="text-muted-foreground leading-relaxed mt-4">{t('s4.footer')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s5.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s5.intro')}</p>
              <BulletList items={s5Items} />
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s6.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s6.body')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s7.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s7.intro')}</p>
              <BulletList items={s7Items} />
              <p className="text-muted-foreground leading-relaxed mt-4">{t('s7.footer')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s8.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s8.intro')}</p>
              <BulletList items={s8Items} />
              <p className="text-muted-foreground leading-relaxed mt-4">{t('s8.footer')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s9.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s9.body')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s10.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s10.body')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s11.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s11.body')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s12.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s12.body')}</p>
              <div className="mt-4 p-4 bg-muted rounded-xl">
                <p className="text-muted-foreground">{t('s12.contactBox')}</p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
