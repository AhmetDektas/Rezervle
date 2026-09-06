import Link from 'next/link';
import { Check, ArrowRight, Circle } from 'lucide-react';
import type { Checklist } from '@/server/activation';

/**
 * Kurulum kontrol listesi kartı (T20).
 *
 * Her şey tamamsa hiç görünmüyor: bitmiş bir listeyi panelde tutmak, panoyu
 * kalıcı olarak gürültüyle doldurmak olurdu.
 */
export function ActivationChecklist({ liste }: { liste: Checklist }) {
  if (liste.tamamlanan === liste.toplam) return null;

  return (
    <section className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-navy">Kurulumunuzu tamamlayın</h2>
        <span className="tnum text-[13px] text-brand-700">
          {liste.tamamlanan}/{liste.toplam}
        </span>
      </div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
        {liste.rezervasyonaHazir
          ? 'Randevu almaya hazırsınız. Kalan adımlar işletmenizin keşfette daha iyi görünmesini sağlar.'
          : 'Zorunlu adımlar tamamlanmadan müşteriler sizden randevu alamaz.'}
      </p>

      <ol className="mt-4 space-y-2">
        {liste.maddeler.map((m) => (
          <li key={m.id}>
            <Link
              href={m.href}
              className={`flex items-start gap-3 rounded-xl border bg-surface px-3.5 py-3 transition hover:border-brand-400 ${
                m.tamam ? 'border-line opacity-70' : 'border-line-strong'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  m.tamam ? 'bg-success text-white' : 'text-ink-3'
                }`}
                aria-hidden
              >
                {m.tamam ? <Check size={13} /> : <Circle size={13} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[14px] font-medium ${m.tamam ? 'text-ink-3 line-through' : 'text-navy'}`}
                  >
                    {m.baslik}
                  </span>
                  {!m.zorunlu ? (
                    <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-3">
                      isteğe bağlı
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[13px] text-ink-3">{m.aciklama}</span>
              </span>
              {!m.tamam ? (
                <ArrowRight size={16} className="mt-1 shrink-0 text-ink-3" aria-hidden />
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
