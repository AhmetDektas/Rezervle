'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { loginAction, registerAction, demoLoginAction, type AuthResult } from '@/app/actions/auth';
import type { Role } from '@/lib/constants';

const HOME_BY_ROLE: Record<Role, string> = {
  CUSTOMER: '/',
  STAFF: '/panel',
  OWNER: '/panel',
  ADMIN: '/yonetim',
};

const DEMO_ACCOUNTS = [
  { label: 'Müşteri', email: 'demo@rezzerv.com' },
  { label: 'İşletme sahibi', email: 'serhat@beyazdis.com' },
  { label: 'Personel', email: 'aylin.kara@beyazdispoliklinigi.com' },
  { label: 'Yönetici', email: 'admin@rezzerv.com' },
];

export function AuthForm({ mode, showDemo }: { mode: 'login' | 'register'; showDemo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const next = params.get('next');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  function handleResult(result: AuthResult) {
    if (result.ok) {
      const target = next && next.startsWith('/') ? next : HOME_BY_ROLE[result.data.role];
      toast.success(mode === 'login' ? 'Giriş yapıldı' : 'Hesabınız oluşturuldu');
      router.replace(target);
      router.refresh();
      return;
    }
    setError(result.error);
    setFields(result.fields ?? {});
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFields({});
    try {
      const data = new FormData(event.currentTarget);
      handleResult(mode === 'login' ? await loginAction(data) : await registerAction(data));
    } finally {
      setPending(false);
    }
  }

  async function onDemo(email: string) {
    setPending(true);
    setError(null);
    try {
      handleResult(await demoLoginAction(email));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
        {mode === 'login' ? 'Tekrar hoş geldiniz' : 'Rezzerv hesabı oluşturun'}
      </h1>
      <p className="mt-1.5 text-[14px] text-ink-2">
        {mode === 'login'
          ? 'Randevularınızı görmek ve yenisini almak için giriş yapın.'
          : 'Randevu almak yalnızca birkaç saniye sürer.'}
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-3 text-[13.5px] text-danger"
        >
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        {mode === 'register' ? (
          <Field label="Ad soyad" htmlFor="name" error={fields['name']} required>
            <Input id="name" name="name" autoComplete="name" placeholder="Elif Yıldırım" required aria-invalid={Boolean(fields['name'])} />
          </Field>
        ) : null}

        <Field label="E-posta" htmlFor="email" error={fields['email']} required>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="ornek@eposta.com" required aria-invalid={Boolean(fields['email'])} />
        </Field>

        {mode === 'register' ? (
          <Field label="Telefon" htmlFor="phone" error={fields['phone']} hint="Randevu hatırlatmaları için kullanılır.">
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0532 123 45 67" aria-invalid={Boolean(fields['phone'])} />
          </Field>
        ) : null}

        <Field
          label="Parola"
          htmlFor="password"
          error={fields['password']}
          {...(mode === 'register' ? { hint: 'En az 8 karakter, bir harf ve bir rakam.' } : {})}
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            required
            aria-invalid={Boolean(fields['password'])}
          />
        </Field>

        {mode === 'register' ? (
          <Field error={fields['kvkk']}>
            <label className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
              <input
                type="checkbox"
                name="kvkk"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-brand-500 focus:ring-2 focus:ring-brand-100"
                aria-invalid={Boolean(fields['kvkk'])}
              />
              <span>
                <Link href="/kvkk" className="font-medium text-brand-600 underline-offset-4 hover:underline">
                  Aydınlatma metnini
                </Link>{' '}
                okudum; randevu geçmişimin işlenmesine açık rıza veriyorum.
              </span>
            </label>
          </Field>
        ) : null}

        <Button type="submit" size="lg" full loading={pending}>
          {mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
        </Button>
      </form>

      <p className="mt-4 text-center text-[13.5px] text-ink-2">
        {mode === 'login' ? 'Hesabınız yok mu? ' : 'Zaten hesabınız var mı? '}
        <Link
          href={mode === 'login' ? `/kayit${next ? `?next=${encodeURIComponent(next)}` : ''}` : `/giris${next ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-medium text-brand-600 underline-offset-4 hover:underline"
        >
          {mode === 'login' ? 'Kayıt olun' : 'Giriş yapın'}
        </Link>
      </p>

      {showDemo ? (
        <div className="mt-7 rounded-2xl border border-dashed border-line-strong bg-sunken/60 p-4">
          <p className="text-[13px] font-medium text-ink-2">Demo hesapları (yalnızca geliştirme)</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">Parola: Rezzerv123</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <Button key={a.email} type="button" variant="secondary" size="sm" onClick={() => onDemo(a.email)} disabled={pending}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
