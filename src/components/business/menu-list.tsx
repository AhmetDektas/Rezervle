import { money } from '@/lib/format';

export type MenuEntry = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
};

/**
 * Restoran menüsü.
 *
 * Bölümlere ayrılıyor ("Başlangıçlar", "Ana yemekler"...) çünkü düz bir liste
 * kırk kalemde okunmaz hâle gelir. Bölüm sırası, işletmenin verdiği
 * `sortOrder` sırasını koruyor: mutfağın kendi mantığı bizim alfabemizden
 * daha doğru.
 *
 * Fiyatlar bilgilendirme amaçlı; rezervasyon tutarına girmiyor. Müşteri ne
 * yiyeceğini masada seçiyor ve peşin menü ödemesi istemek, restoran
 * rezervasyonunun doğasına aykırı olurdu.
 */
export function MenuList({ items }: { items: MenuEntry[] }) {
  if (items.length === 0) return null;

  const bolumler = new Map<string, MenuEntry[]>();
  for (const item of items) {
    const mevcut = bolumler.get(item.category);
    if (mevcut) mevcut.push(item);
    else bolumler.set(item.category, [item]);
  }

  return (
    <div className="space-y-6">
      {[...bolumler.entries()].map(([bolum, kalemler]) => (
        <section key={bolum}>
          <h3 className="text-[14px] font-semibold uppercase tracking-wide text-ink-3">{bolum}</h3>
          <ul className="mt-2.5 divide-y divide-line">
            {kalemler.map((k) => (
              <li key={k.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-medium text-navy">{k.name}</p>
                  {k.description ? (
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{k.description}</p>
                  ) : null}
                </div>
                <span className="tnum shrink-0 text-[14px] text-navy">{money(k.price)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="border-t border-line pt-3 text-[12.5px] text-ink-3">
        Menü ve fiyatlar bilgilendirme amaçlıdır; işletme tarafından güncellenir.
        Rezervasyon tutarına dahil değildir.
      </p>
    </div>
  );
}
