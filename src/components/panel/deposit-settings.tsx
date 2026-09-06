'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { updateDepositSettingsAction } from '@/app/actions/panel';
import { depositFor, type DepositPolicy } from '@/lib/deposit';
import { money } from '@/lib/format';

/**
 * Politika alanlarının tamamı. `DepositPolicy` ile birebir aynı olduğu için
 * yeniden tanımlanmıyor: alan eklenince iki yerde birden güncellemek gerekirdi
 * ve biri unutulursa tip kontrolü sessiz kalırdı.
 */
export type DepositValues = DepositPolicy;

/** Örnek hesap için kullanılan temsilî hizmet ücreti. */
const SAMPLE_PRICE = 1000;

export function DepositSettings({
  slug,
  businessId,
  initial,
}: {
  slug: string;
  businessId: string;
  initial: DepositValues;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  // Canlı önizleme: oranı değiştirirken ne kadar kapora isteneceği görünsün.
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [kind, setKind] = React.useState(initial.kind);
  const [value, setValue] = React.useState(String(initial.value));
  const [minPrice, setMinPrice] = React.useState(String(initial.minPrice));
  const [refundHours, setRefundHours] = React.useState(String(initial.refundHours));

  if (!initial.platformEnabled) {
    return (
      <div className="rounded-2xl border border-warn-line bg-warn-soft p-5">
        <p className="text-[15px] font-semibold text-warn">Kapora tahsilatı geçici olarak duraklatıldı</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-warn/90">
          Platform genelinde kapora tahsilatı şu anda kapalı. Randevular normal şekilde
          alınmaya devam ediyor; ödeme işletmenizde yapılıyor. Ayarlarınız korunuyor ve
          tahsilat yeniden açıldığında kaldığı yerden geçerli olacak.
        </p>
      </div>
    );
  }

  if (!initial.addon) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-sunken/50 p-5 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-ink-3">
          <Lock size={20} aria-hidden />
        </span>
        <p className="mt-3 text-[15px] font-semibold text-navy">Kapora paketi kapalı</p>
        <p className="mx-auto mt-1 max-w-md text-[13.5px] leading-relaxed text-ink-3">
          Kapora, randevuya gelmeme oranını düşürmek için sunulan ek pakettir. Müşteri
          randevu oluştururken belirlediğiniz tutarı öder; randevuya gelinmezse kapora
          size kalır. Paketi açtırmak için platform yöneticisiyle görüşün.
        </p>
      </div>
    );
  }

  const policy: DepositPolicy = {
    // Önizleme "bu ayarla ne olurdu" sorusunu cevaplar; işletmenin kendi
    // açma/kapama tercihini yok sayar. Platform şalterini ise yok sayamaz:
    // şalter kapalıyken kapora hiç tahsil edilmiyor.
    platformEnabled: initial.platformEnabled,
    addon: true,
    enabled: true,
    kind,
    value: Number(value) || 0,
    minPrice: Number(minPrice) || 0,
    refundHours: Number(refundHours) || 0,
  };
  const preview = depositFor(policy, SAMPLE_PRICE);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFields({});
    setError(null);
    const result = await updateDepositSettingsAction(slug, businessId, {
      enabled,
      kind,
      value,
      minPrice,
      refundHours,
    });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      setError(result.error);
      return;
    }
    toast.success(enabled ? 'Kapora açık' : 'Kapora kapatıldı');
    router.refresh();
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger"
        >
          {error}
        </div>
      ) : null}

      <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-surface px-4">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-[18px] w-[18px] rounded border-line-strong"
        />
        <span>
          <span className="block text-[14px] font-medium text-navy">
            Online randevularda kapora iste
          </span>
          <span className="block text-[12.5px] text-ink-3">
            Panelden açtığınız telefon/kapı randevularında kapora istenmez.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kapora türü" htmlFor="d-kind">
          <Select id="d-kind" value={kind} onChange={(e) => setKind(e.target.value)} disabled={!enabled}>
            <option value="PERCENT">Hizmet ücretinin yüzdesi</option>
            <option value="AMOUNT">Sabit tutar</option>
          </Select>
        </Field>
        <Field
          label={kind === 'PERCENT' ? 'Yüzde (%)' : 'Tutar (TL)'}
          htmlFor="d-value"
          error={fields['value']}
          required
        >
          <Input
            id="d-value"
            type="number"
            min={1}
            max={kind === 'PERCENT' ? 100 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!enabled}
          />
        </Field>
        <Field
          label="Alt limit (TL)"
          htmlFor="d-min"
          error={fields['minPrice']}
          hint="Bu tutarın altındaki randevularda kapora istenmez. 0 = her randevuda."
        >
          <Input
            id="d-min"
            type="number"
            min={0}
            step={50}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            disabled={!enabled}
          />
        </Field>
        <Field
          label="İade süresi (saat)"
          htmlFor="d-refund"
          error={fields['refundHours']}
          hint="Randevuya bu süreden fazla varken iptal edilirse kapora iade edilir."
        >
          <Input
            id="d-refund"
            type="number"
            min={0}
            max={168}
            value={refundHours}
            onChange={(e) => setRefundHours(e.target.value)}
            disabled={!enabled}
          />
        </Field>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
        <p className="text-[13px] leading-relaxed text-brand-700">
          {enabled ? (
            preview > 0 ? (
              <>
                <span className="font-semibold">{money(SAMPLE_PRICE)}</span> tutarındaki bir
                randevuda müşteriden <span className="font-semibold">{money(preview)}</span>{' '}
                kapora istenir. Randevuya gelinmezse bu tutar size kalır; {refundHours || 0}{' '}
                saatten önce iptal edilirse iade edilir.
              </>
            ) : (
              <>
                Bu ayarlarla {money(SAMPLE_PRICE)} tutarındaki bir randevuda kapora istenmez.
                Alt limiti düşürmeyi deneyin.
              </>
            )
          ) : (
            <>Kapora şu anda kapalı. Açtığınızda yalnızca yeni online randevular etkilenir.</>
          )}
        </p>
      </div>

      <Button type="submit" loading={pending}>
        Kapora ayarlarını kaydet
      </Button>
    </form>
  );
}
