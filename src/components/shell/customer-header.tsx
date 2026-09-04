'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Heart, CalendarCheck, User2, LogOut, LayoutDashboard, Shield } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { SearchInput } from './search-input';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/constants';

export type HeaderUser = { id: string; name: string; role: Role; avatarSeed: string } | null;

const NAV = [
  { href: '/kesfet', label: 'Keşfet' },
  { href: '/randevularim', label: 'Randevularım' },
  { href: '/favorilerim', label: 'Favorilerim' },
];

export function CustomerHeader({
  user,
  unread,
  showSearch = true,
}: {
  user: HeaderUser;
  unread: number;
  showSearch?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Ana sayfada arama kutusu kahramanın içinde duruyor ve sayfanın asıl
  // çağrısı o. Başlıktaki kutu onunla birlikte görününce ekranda 30 px arayla
  // iki özdeş arama alanı oluyordu (mobilde üst üste); hangisinin ne yaptığı
  // belirsizdi. Diğer sayfalarda başlıktaki kutu tek ve kalıcı arama yeri.
  const searchVisible = showSearch && pathname !== '/';

  React.useEffect(() => setMenuOpen(false), [pathname]);
  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded-xl" aria-label="Rezzerv ana sayfa">
          <Logo size={28} />
        </Link>

        {searchVisible ? (
          <React.Suspense fallback={<div className="hidden h-11 flex-1 md:block" />}>
            <SearchInput className="hidden flex-1 md:block" />
          </React.Suspense>
        ) : (
          <div className="flex-1" />
        )}

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Ana gezinme">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-xl px-3 py-2 text-[14px] font-medium transition',
                pathname.startsWith(item.href) ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-sunken hover:text-navy',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {user ? (
            <>
              <Link
                href="/bildirimler"
                className="relative flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 transition hover:bg-sunken hover:text-navy"
                aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
              >
                <Bell size={19} aria-hidden />
                {unread > 0 ? (
                  <span className="tnum absolute right-1.5 top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </Link>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-11 items-center gap-2 rounded-xl px-1.5 transition hover:bg-sunken"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <Avatar name={user.name} size={32} hue={Number(user.avatarSeed) * 37} />
                  <span className="hidden max-w-[110px] truncate text-[14px] font-medium text-navy sm:block">
                    {user.name.split(' ')[0]}
                  </span>
                </button>

                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[52px] z-50 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop animate-scale-in"
                  >
                    <div className="px-3 py-2">
                      <p className="truncate text-[14px] font-medium text-navy">{user.name}</p>
                      <p className="text-[12px] text-ink-3">
                        {user.role === 'CUSTOMER' ? 'Müşteri hesabı' : user.role === 'ADMIN' ? 'Platform yöneticisi' : 'İşletme hesabı'}
                      </p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <MenuLink href="/randevularim" icon={CalendarCheck}>Randevularım</MenuLink>
                    <MenuLink href="/favorilerim" icon={Heart}>Favorilerim</MenuLink>
                    <MenuLink href="/profil" icon={User2}>Profilim</MenuLink>
                    {(user.role === 'OWNER' || user.role === 'STAFF') ? (
                      <MenuLink href="/panel" icon={LayoutDashboard}>İşletme paneli</MenuLink>
                    ) : null}
                    {user.role === 'ADMIN' ? (
                      <MenuLink href="/yonetim" icon={Shield}>Yönetim</MenuLink>
                    ) : null}
                    <div className="my-1 h-px bg-line" />
                    <form action="/cikis" method="post">
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] text-danger transition hover:bg-danger-soft"
                      >
                        <LogOut size={16} aria-hidden />
                        Çıkış yap
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/giris">Giriş yap</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/kayit">Kayıt ol</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {searchVisible ? (
        <div className="border-t border-line px-4 py-2.5 md:hidden">
          <React.Suspense fallback={<div className="h-11" />}>
            <SearchInput />
          </React.Suspense>
        </div>
      ) : null}
    </header>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] text-ink-2 transition hover:bg-sunken hover:text-navy"
    >
      <Icon size={16} aria-hidden />
      {children}
    </Link>
  );
}
