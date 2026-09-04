'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { updateProfileAction } from '@/app/actions/customer';
import { ANKARA_DISTRICTS, CITIES } from '@/lib/constants';

export type ProfileValues = {
  name: string;
  phone: string;
  city: string;
  district: string;
  smsOptIn: boolean;
  emailOptIn: boolean;
};

export function ProfileForm({ initial, email }: { initial: ProfileValues; email: string }) {
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const toast = useToast();
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFields({});
    const result = await updateProfileAction(new FormData(event.currentTarget));
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      toast.error(result.error);
      return;
    }
    toast.success('Bilgileriniz güncellendi');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Ad soyad" htmlFor="p-name" error={fields['name']} required>
        <Input id="p-name" name="name" defaultValue={initial.name} required />
      </Field>

      <Field label="E-posta" htmlFor="p-email" hint="E-posta adresi değiştirilemez.">
        <Input id="p-email" value={email} disabled readOnly />
      </Field>

      <Field label="Telefon" htmlFor="p-phone" error={fields['phone']} hint="Randevu hatırlatmaları için kullanılır.">
        <Input id="p-phone" name="phone" type="tel" defaultValue={initial.phone} placeholder="0532 123 45 67" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Şehir" htmlFor="p-city">
          <Select id="p-city" name="city" defaultValue={initial.city}>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Semt" htmlFor="p-district">
          <Select id="p-district" name="district" defaultValue={initial.district}>
            <option value="">Seçiniz</option>
            {ANKARA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium text-ink-2">İletişim tercihleri</legend>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line-strong px-3.5">
          <input type="checkbox" name="smsOptIn" defaultChecked={initial.smsOptIn} className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500" />
          <span className="text-[14px] text-navy">SMS ile randevu hatırlatması al</span>
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line-strong px-3.5">
          <input type="checkbox" name="emailOptIn" defaultChecked={initial.emailOptIn} className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500" />
          <span className="text-[14px] text-navy">E-posta ile bilgilendirme al</span>
        </label>
      </fieldset>

      <Button type="submit" loading={pending}>Değişiklikleri kaydet</Button>
    </form>
  );
}
