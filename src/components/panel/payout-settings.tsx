'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { updatePayoutAction } from '@/app/actions/panel';
import { splitPayment } from '@/lib/commission';
import { money } from '@/lib/format';

export type PayoutValues = {
  payoutTitle: string;
  payoutIban: string;
  taxNumber: string;
  commissionRate: number;
};

/** Örnek hesaplamada kullanılan temsilî kapora. */
const SAMPLE = 300;

export function PayoutSettings({
  slug,
  businessId,
  initial,
}: {
  slug: string;
  businessId: string;
  initial: PayoutValues;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const example = splitPayment(SAMPLE, initial.commissionRate);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFields({});
    setError(null);
    const result = await updatePayoutAction(slug, businessId, {
      payoutTitle: form.get('payoutTitle'),
      payoutIban: form.get('payoutIban'),
      taxNumber: form.get('taxNumber'),
    });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      setError(result.error);
      return;
    }
    toast.success('Hak ediş hesabı güncellendi');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-xl border border-line bg-sunken/60 px-3.5 py-3">
        <Landmark size={17} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
        <p className="text-[13px] leading-relaxed text-ink-2">
          Kapora, lisanslı ödeme kuruluşunda toplanır ve randevu sonuçlanınca komisyon
          düşülerek doğrudan bu hesaba aktarılır. Rezzerv müşteri parasını kendi hesabında
          tutmaz.
          <span className="mt-1.5 block font-medium text-navy">
            Örnek: {money(SAMPLE)} kaporada {money(example.commission)} komisyon (%
            {initial.commissionRate}), hesabınıza {money(example.net)} geçer.
          </span>
        </p>
      </div>

      <Field
        label="Hesap ünvanı"
        htmlFor="p-title"
        error={fields['payoutTitle']}
        required
        hint="Ödeme kuruluşundaki kayıtla birebir aynı olmalı."
      >
        <Input id="p-title" name="payoutTitle" defaultValue={initial.payoutTitle} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="IBAN" htmlFor="p-iban" error={fields['payoutIban']} required>
          <Input
            id="p-iban"
            name="payoutIban"
            defaultValue={initial.payoutIban}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            required
          />
        </Field>
        <Field
          label="Vergi / TC kimlik no"
          htmlFor="p-tax"
          error={fields['taxNumber']}
          required
        >
          <Input id="p-tax" name="taxNumber" defaultValue={initial.taxNumber} inputMode="numeric" required />
        </Field>
      </div>

      <Button type="submit" loading={pending}>
        Hak ediş hesabını kaydet
      </Button>
    </form>
  );
}
