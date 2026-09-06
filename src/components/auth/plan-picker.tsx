'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { money } from '@/lib/format';
import { PLANS, TRIAL_DAYS, type PlanKey } from '@/lib/plans';
import { choosePlanAction } from '@/app/actions/auth';

/**
 * Paket seçimi (kaydın ikinci adımı).
 *
 * Deneme başvuruyla birlikte başladığı için bu sayfa bir **kapı değil**:
 * "Şimdilik geç" diyen işletme de panele girebiliyor. Paket seçimini zorunlu
 * kılmak, ürünü henüz görmemiş birine fiyat kararı verdirmek olurdu — ankette
 * %51'i teknoloji düzeyini "düşük" olarak tanımlayan bir kitlede en hızlı
 * terk sebebi bu.
 */
export function PlanPicker({ current }: { current: PlanKey | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);

  async function sec(key: PlanKey) {
    setPending(key);
    const r = await choosePlanAction(key);
    setPending(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success('Paketiniz seçildi', `${TRIAL_DAYS} günlük deneme başladı.`);
    router.replace('/panel');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-[13px] font-medium text-success">
          <Sparkles size={14} aria-hidden />
          {TRIAL_DAYS} gün ücretsiz deneme
        </span>
        <h1 className="mt-3 text-[24px] font-semibold tracking-[-0.02em] sm:text-[30px]">
          İşletmenize uygun paketi seçin
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-[14.5px] leading-relaxed text-ink-2">
          Deneme süresi boyunca ödeme alınmaz ve kart bilgisi istenmez. Süre
          bitmeden size hatırlatacağız; dilediğiniz zaman paket değiştirebilirsiniz.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const secili = current === p.key;
          return (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-2xl border bg-surface p-5 ${
                p.popular ? 'border-brand-400 shadow-card' : 'border-line'
              }`}
            >
              {p.popular ? (
                <span className="absolute -top-2.5 left-5 rounded-full bg-brand-500 px-2.5 py-0.5 text-[11.5px] font-medium text-white">
                  En çok tercih edilen
                </span>
              ) : null}

              <h2 className="text-[17px] font-semibold text-navy">{p.name}</h2>
              <p className="mt-0.5 text-[13.5px] text-ink-3">{p.tagline}</p>

              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="tnum text-[28px] font-semibold tracking-[-0.02em] text-navy">
                  {money(p.price)}
                </span>
                <span className="text-[13.5px] text-ink-3">/ ay</span>
              </p>

              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px] text-ink-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-success" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-5"
                full
                variant={p.popular ? 'primary' : 'secondary'}
                loading={pending === p.key}
                disabled={pending !== null}
                onClick={() => sec(p.key)}
              >
                {secili ? 'Seçili paket' : 'Bu paketi seç'}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <Button variant="ghost" onClick={() => router.replace('/panel')} disabled={pending !== null}>
          Şimdilik geç, panele git
        </Button>
        <p className="mt-1 text-[12.5px] text-ink-3">
          Denemeniz zaten başladı. Paketi daha sonra ayarlardan seçebilirsiniz.
        </p>
      </div>
    </div>
  );
}
