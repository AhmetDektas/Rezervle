import Link from 'next/link';
import { SECTOR_ICON } from './cover';

type Category = { slug: string; name: string; sector: string; blurb: string; count: number };

/** Kategori keşfi — mobilde yatay kaydırılır, masaüstünde ızgara. */
export function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <ul className="rail sm:grid sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
      {categories.map((c) => {
        const Icon = SECTOR_ICON[c.sector] ?? SECTOR_ICON['BEAUTY']!;
        const disabled = c.count === 0;
        return (
          <li key={c.slug} className="w-[46%] shrink-0 snap-start sm:w-auto">
            <Link
              href={`/kesfet?kategori=${c.slug}`}
              aria-disabled={disabled}
              className="card card-hover flex h-full flex-col gap-2 p-3.5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon size={20} aria-hidden />
              </span>
              <span className="text-[14px] font-semibold leading-tight text-navy">{c.name}</span>
              <span className="mt-auto text-[12px] text-ink-3">
                {disabled ? 'Yakında' : `${c.count} işletme`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
