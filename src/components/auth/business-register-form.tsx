'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { registerBusinessAction } from '@/app/actions/auth';

export type CategoryOption = { slug: string; name: string };

/**
 * İşletme başvurusu formu.
 *
 * Alanlar bilinçli olarak az: yalnızca "kimsiniz ve neredesiniz". Çalışma
 * saati, hizmet ve personel onaydan sonra panelde isteniyor (S11-2). Henüz
 * ürüne güvenmemiş bir işletme sahibi uzun formu büyük ihtimalle bitirmez;
 * iki taraflı pazaryerlerinde arz tarafının hiç kaydolmaması en pahalı hata.
 *
 * Kategori ve semt sunucudan geliyor: kategori listesi veritabanındaki aktif
 * kayıtlar, semt ise sabit Ankara listesi. Serbest metin olsaydı "Keçiören",
 * "keçiören" ve "Kecioren" ayrı semtler gibi görünür, slug ve arama bozulurdu.
 */
export function BusinessRegisterForm({
  categories,
  districts,
}: {
  categories: CategoryOption[];
  districts: readonly string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFields({});
    try {
      const result = await registerBusinessAction(new FormData(event.currentTarget));
      if (result.ok) {
        toast.success('Başvurunuz alındı');
        // Paket seçimi kaydın devamı: işletme ödeyeceği paketi burada
        // belirliyor. Vazgeçerse denemesi yine başlamış oluyor.
        router.replace('/kayit/isletme/paket');
        router.refresh();
        return;
      }
      setError(result.error);
      setFields(result.fields ?? {});
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">İşletmenizi Rezzerv’e ekleyin</h1>
      <p className="mt-1.5 text-[14px] text-ink-2">
        Başvurunuzu inceleyip onayladıktan sonra işletmeniz yayına alınır. Onayı beklerken
        panelde hizmetlerinizi ve çalışma saatlerinizi hazırlayabilirsiniz.
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

      <form method="post" onSubmit={onSubmit} className="mt-5 space-y-6" noValidate>
        <fieldset className="space-y-4">
          <legend className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">
            İşletme
          </legend>

          <Field label="İşletme adı" htmlFor="b-name" error={fields['businessName']} required>
            <Input
              id="b-name"
              name="businessName"
              autoComplete="organization"
              placeholder="Berber Ali"
              required
              aria-invalid={Boolean(fields['businessName'])}
            />
          </Field>

          <Field label="Kategori" htmlFor="b-category" error={fields['categorySlug']} required>
            <Select
              id="b-category"
              name="categorySlug"
              defaultValue=""
              required
              aria-invalid={Boolean(fields['categorySlug'])}
            >
              <option value="" disabled>
                Seçin
              </option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Semt" htmlFor="b-district" error={fields['district']} required>
            <Select
              id="b-district"
              name="district"
              defaultValue=""
              required
              aria-invalid={Boolean(fields['district'])}
            >
              <option value="" disabled>
                Seçin
              </option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Açık adres"
            htmlFor="b-address"
            error={fields['address']}
            hint="Mahalle, cadde ve numara."
            required
          >
            <Input
              id="b-address"
              name="address"
              autoComplete="street-address"
              placeholder="Kalaba Mah. Şehit Sok. No:5"
              required
              aria-invalid={Boolean(fields['address'])}
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">
            Yetkili
          </legend>

          <Field label="Ad soyad" htmlFor="b-owner" error={fields['ownerName']} required>
            <Input
              id="b-owner"
              name="ownerName"
              autoComplete="name"
              placeholder="Ali Veli"
              required
              aria-invalid={Boolean(fields['ownerName'])}
            />
          </Field>

          <Field label="E-posta" htmlFor="b-email" error={fields['email']} required>
            <Input
              id="b-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ornek@eposta.com"
              required
              aria-invalid={Boolean(fields['email'])}
            />
          </Field>

          <Field
            label="Telefon"
            htmlFor="b-phone"
            error={fields['phone']}
            hint="Onay sonucunu buradan bildiriyoruz."
            required
          >
            <Input
              id="b-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0532 123 45 67"
              required
              aria-invalid={Boolean(fields['phone'])}
            />
          </Field>

          <Field
            label="Parola"
            htmlFor="b-password"
            error={fields['password']}
            hint="En az 8 karakter, bir harf ve bir rakam."
            required
          >
            <Input
              id="b-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              aria-invalid={Boolean(fields['password'])}
            />
          </Field>
        </fieldset>

        <Field error={fields['kvkk']}>
          <label className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
            <input
              id="b-kvkk"
              type="checkbox"
              name="kvkk"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-brand-500 focus:ring-2 focus:ring-brand-100"
              aria-invalid={Boolean(fields['kvkk'])}
            />
            <span>
              <Link href="/kvkk" className="font-medium text-brand-600 underline-offset-4 hover:underline">
                Aydınlatma metnini
              </Link>{' '}
              okudum; işletme ve iletişim bilgilerimin Rezzerv’de yayınlanmasını kabul
              ediyorum.
            </span>
          </label>
        </Field>

        <Button type="submit" size="lg" full loading={pending}>
          Başvuruyu gönder
        </Button>
      </form>

      <p className="mt-4 text-center text-[13.5px] text-ink-2">
        Zaten hesabınız var mı?{' '}
        <Link href="/giris" className="font-medium text-brand-600 underline-offset-4 hover:underline">
          Giriş yapın
        </Link>
      </p>
    </div>
  );
}
