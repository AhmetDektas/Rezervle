'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { updateBusinessProfileAction, replyToReviewAction } from '@/app/actions/panel';

export type BusinessProfileValues = {
  name: string;
  tagline: string;
  about: string;
  phone: string;
  email: string;
  website: string;
  priceLevel: number;
  amenities: string[];
};

export function BusinessProfileForm({
  slug,
  businessId,
  initial,
}: {
  slug: string;
  businessId: string;
  initial: BusinessProfileValues;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [amenities, setAmenities] = React.useState<string[]>(initial.amenities);
  const [draft, setDraft] = React.useState('');

  function addAmenity() {
    const value = draft.trim();
    if (!value || amenities.includes(value) || amenities.length >= 20) return;
    setAmenities((prev) => [...prev, value]);
    setDraft('');
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFields({});
    const result = await updateBusinessProfileAction(slug, businessId, {
      name: form.get('name'),
      tagline: form.get('tagline') ?? '',
      about: form.get('about') ?? '',
      phone: form.get('phone') ?? '',
      email: form.get('email') ?? '',
      website: form.get('website') ?? '',
      priceLevel: form.get('priceLevel'),
      amenities,
    });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      toast.error(result.error);
      return;
    }
    toast.success('İşletme bilgileri güncellendi');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="İşletme adı" htmlFor="bp-name" error={fields['name']} required>
        <Input id="bp-name" name="name" defaultValue={initial.name} required />
      </Field>

      <Field
        label="Kısa tanıtım"
        htmlFor="bp-tagline"
        error={fields['tagline']}
        hint="Kartlarda ve arama sonuçlarında görünür."
      >
        <Input id="bp-tagline" name="tagline" defaultValue={initial.tagline} maxLength={120} />
      </Field>

      <Field label="Hakkında" htmlFor="bp-about" error={fields['about']}>
        <Textarea id="bp-about" name="about" defaultValue={initial.about} className="min-h-[140px]" maxLength={2000} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Telefon" htmlFor="bp-phone" error={fields['phone']}>
          <Input id="bp-phone" name="phone" defaultValue={initial.phone} />
        </Field>
        <Field label="E-posta" htmlFor="bp-email" error={fields['email']}>
          <Input id="bp-email" name="email" type="email" defaultValue={initial.email} />
        </Field>
        <Field label="Fiyat segmenti" htmlFor="bp-price">
          <Select id="bp-price" name="priceLevel" defaultValue={String(initial.priceLevel)}>
            <option value="1">Ekonomik</option>
            <option value="2">Orta</option>
            <option value="3">Üst segment</option>
          </Select>
        </Field>
      </div>

      <Field label="Web sitesi" htmlFor="bp-web" error={fields['website']}>
        <Input id="bp-web" name="website" type="url" defaultValue={initial.website} placeholder="https://" />
      </Field>

      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2">Olanaklar</legend>
        <p className="mt-0.5 text-[12.5px] text-ink-3">
          İşletme sayfasında rozet olarak listelenir (otopark, wi-fi, engelli erişimi…).
        </p>
        <div className="mt-2 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAmenity();
              }
            }}
            placeholder="Otopark"
            aria-label="Olanak ekle"
            maxLength={40}
          />
          <Button type="button" variant="secondary" onClick={addAmenity} aria-label="Olanağı listeye ekle">
            <Plus size={16} aria-hidden />
          </Button>
        </div>
        {amenities.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {amenities.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => setAmenities((prev) => prev.filter((x) => x !== a))}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-line-strong bg-sunken px-3 text-[13px] text-ink-2 transition hover:border-danger-line hover:text-danger"
                >
                  {a}
                  <X size={13} aria-hidden />
                  <span className="sr-only">kaldır</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      <Button type="submit" loading={pending}>
        Değişiklikleri kaydet
      </Button>
    </form>
  );
}

export function ReviewReply({
  slug,
  reviewId,
  existing,
}: {
  slug: string;
  reviewId: string;
  existing: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(existing ?? '');
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await replyToReviewAction(slug, reviewId, text);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Yanıtınız yayınlandı');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {existing ? 'Yanıtı düzenle' : 'Yanıtla'}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Değerlendirmeye kısa bir yanıt yazın…"
        aria-label="Değerlendirme yanıtı"
        maxLength={600}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending} disabled={text.trim().length < 2}>
          <Send size={14} aria-hidden />
          Yayınla
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
