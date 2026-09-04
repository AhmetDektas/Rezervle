'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, CalendarCheck, Heart, User2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Ana sayfa', icon: Home, exact: true },
  { href: '/kesfet', label: 'Keşfet', icon: Search, exact: false },
  { href: '/randevularim', label: 'Randevular', icon: CalendarCheck, exact: false },
  { href: '/favorilerim', label: 'Favoriler', icon: Heart, exact: false },
  { href: '/profil', label: 'Profil', icon: User2, exact: false },
];

/** Mobil alt gezinme. Masaüstünde gizlenir; oradaki gezinme başlıkta. */
export function CustomerTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
      aria-label="Alt gezinme"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-[62px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition',
                  active ? 'text-brand-600' : 'text-ink-3',
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
