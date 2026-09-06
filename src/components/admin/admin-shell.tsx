'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield, Store, Users, Layers, MessageSquareWarning, CalendarDays, LogOut, ExternalLink, Wallet,
  ListChecks, BarChart3,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/yonetim', label: 'Genel bakış', icon: Shield, exact: true },
  { href: '/yonetim/isletmeler', label: 'İşletmeler', icon: Store, exact: false },
  { href: '/yonetim/kullanicilar', label: 'Kullanıcılar', icon: Users, exact: false },
  { href: '/yonetim/kategoriler', label: 'Kategoriler', icon: Layers, exact: false },
  { href: '/yonetim/degerlendirmeler', label: 'Değerlendirmeler', icon: MessageSquareWarning, exact: false },
  { href: '/yonetim/randevular', label: 'Randevular', icon: CalendarDays, exact: false },
  { href: '/yonetim/komisyon', label: 'Komisyon', icon: Wallet, exact: false },
  { href: '/yonetim/analitik', label: 'Analitik', icon: BarChart3, exact: false },
  { href: '/yonetim/kuyruk', label: 'Kuyruk', icon: ListChecks, exact: false },
];

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; avatarSeed: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-navy">
        <div className="mx-auto flex h-[58px] max-w-[1300px] items-center gap-3 px-4 sm:px-6">
          <Link href="/yonetim" className="shrink-0">
            <Logo size={26} tone="light" />
          </Link>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-medium text-white/80">
            Yönetim
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white sm:flex"
            >
              <ExternalLink size={15} aria-hidden />
              Siteye dön
            </Link>
            <form action="/cikis" method="post">
              <button
                type="submit"
                className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut size={15} aria-hidden />
                Çıkış
              </button>
            </form>
            <Avatar name={user.name} size={30} hue={Number(user.avatarSeed) * 37} />
          </div>
        </div>
        <nav
          className="mx-auto flex max-w-[1300px] gap-1 overflow-x-auto px-3 pb-2 no-scrollbar sm:px-5"
          aria-label="Yönetim gezinme"
        >
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium transition',
                  active ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon size={15} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main id="icerik" className="mx-auto max-w-[1300px] p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
