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

export default function TermsOfServicePage() {
  const t = useTranslations('auth.terms');
  const tc = useTranslations('common.actions');

  const s2Items = t.raw('s2.items') as string[];
  const s3Items = t.raw('s3.items') as string[];
  const s4Items = t.raw('s4.items') as string[];
  const s5Items = t.raw('s5.items') as string[];

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
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s2.intro')}</p>
              <BulletList items={s2Items} />
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
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s6a.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s6a.body')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s7.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('s7.body')}</p>
              <p className="text-muted-foreground leading-relaxed">{t('s7.body2')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s8.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s8.body')}</p>
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

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s12.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s12.body')}</p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s13.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s13.body')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">{t('s14.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('s14.body')}</p>
              <div className="mt-4 p-4 bg-muted rounded-xl">
                <p className="text-muted-foreground">{t('s14.contactBox')}</p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
