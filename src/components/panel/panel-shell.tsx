'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  ListChecks,
  Scissors,
  Users,
  Building2,
  UserRound,
  Tag,
  BarChart3,
  Settings,
  Bell,
  ExternalLink,
  Menu,
  X,
  LogOut,
  UtensilsCrossed,
  Clock3,
  AlertTriangle,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/logo';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/constants';
import { trialDaysLeft } from '@/lib/plans';

export type PanelBusiness = {
  id: string;
  name: string;
  slug: string;
  status: string;
  planStatus?: string;
  trialEndsAt?: Date | null;
  /** Paket gerçekten seçildi mi (planPrice > 0). */
  planChosen?: boolean;
};

const NAV = [
  { seg: '', label: 'Bugün', icon: LayoutDashboard },
  { seg: 'takvim', label: 'Takvim', icon: CalendarDays },
  { seg: 'randevular', label: 'Randevular', icon: ListChecks },
  { seg: 'musteriler', label: 'Müşteriler', icon: UserRound },
  { seg: 'hizmetler', label: 'Hizmetler', icon: Scissors },
  // Menü yalnızca restoranda: kuaförün menüsü olmaz, boş bir sayfaya
  // götüren gezinme maddesi gürültüdür.
  { seg: 'menu', label: 'Menü', icon: UtensilsCrossed, restaurantOnly: true },
  { seg: 'personel', label: 'Personel', icon: Users, sectorLabel: true },
  { seg: 'subeler', label: 'Şubeler', icon: Building2 },
  { seg: 'kampanyalar', label: 'Kampanyalar', icon: Tag },
  { seg: 'raporlar', label: 'Raporlar', icon: BarChart3 },
  { seg: 'ayarlar', label: 'Ayarlar', icon: Settings },
];

export function PanelShell({
  business,
  businesses,
  user,
  unread,
  resourcePlural,
  showMenu,
  children,
}: {
  business: PanelBusiness;
  businesses: PanelBusiness[];
  user: { name: string; role: Role; avatarSeed: string };
  unread: number;
  /** "Personel" / "Sahalar" / "Masalar" — sektöre göre gezinme etiketi. */
  resourcePlural: string;
  /** Restoran sektöründe menü sayfası gezinmede görünür. */
  showMenu: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [pathname]);

  const base = `/panel/${business.slug}`;
  const activeSeg = pathname === base ? '' : (pathname.replace(`${base}/`, '').split('/')[0] ?? '');

  const nav = (
    <nav aria-label="Panel gezinme" className="flex flex-col gap-0.5">
      {NAV.filter((item) => showMenu || !('restaurantOnly' in item && item.restaurantOnly)).map((item) => {
        const href = item.seg ? `${base}/${item.seg}` : base;
        const active = activeSeg === item.seg;
        const Icon = item.icon;
        const label = 'sectorLabel' in item && item.sectorLabel ? resourcePlural : item.label;
        return (
          <Link
            key={item.seg}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-[42px] items-center gap-2.5 rounded-xl px-3 text-[14px] font-medium transition',
              active ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-sunken hover:text-navy',
            )}
          >
            <Icon size={17} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Üst bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="flex h-[58px] items-center gap-3 px-3 sm:px-5">
          <button
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 hover:bg-sunken lg:hidden"
            aria-label="Menüyü aç"
          >
            <Menu size={20} aria-hidden />
          </button>

          <Link href="/panel" className="hidden shrink-0 lg:block">
            <Logo size={26} />
          </Link>
          <Link href="/panel" className="shrink-0 lg:hidden" aria-label="Rezzerv paneli">
            <LogoMark size={26} />
          </Link>

          <div className="mx-1 hidden h-6 w-px bg-line lg:block" />

          <BusinessSwitcher business={business} businesses={businesses} />

          <div className="ml-auto flex items-center gap-1">
            {/* Onaylanmamış işletmenin herkese açık sayfası yok (404 döner);
                bağlantıyı göstermek yeni kaydolan her sahibi kırık bir sayfaya
                götürürdü. */}
            {business.status === 'APPROVED' ? (
              <Link
                href={`/isletme/${business.slug}`}
                target="_blank"
                className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 transition hover:bg-sunken hover:text-navy sm:flex"
              >
                <ExternalLink size={15} aria-hidden />
                Sayfayı gör
              </Link>
            ) : null}
            <Link
              href={`${base}/bildirimler`}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 transition hover:bg-sunken"
              aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
            >
              <Bell size={18} aria-hidden />
              {unread > 0 ? (
                <span className="tnum absolute right-1 top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Link>
            <div className="ml-1 flex items-center gap-2 pl-1">
              <Avatar name={user.name} size={30} hue={Number(user.avatarSeed) * 37} />
              <span className="hidden text-[13.5px] font-medium text-navy sm:block">
                {user.name.split(' ').slice(-1)[0]}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Masaüstü kenar çubuğu */}
        <aside className="sticky top-[58px] hidden h-[calc(100dvh-58px)] w-[212px] shrink-0 overflow-y-auto border-r border-line bg-surface p-3 lg:block">
          {nav}
          <div className="mt-4 border-t border-line pt-3">
            <Link
              href="/"
              className="flex min-h-[42px] items-center gap-2.5 rounded-xl px-3 text-[13.5px] text-ink-3 hover:bg-sunken hover:text-navy"
            >
              <ExternalLink size={16} aria-hidden />
              Müşteri uygulaması
            </Link>
            <form action="/cikis" method="post">
              <button
                type="submit"
                className="flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13.5px] text-danger hover:bg-danger-soft"
              >
                <LogOut size={16} aria-hidden />
                Çıkış yap
              </button>
            </form>
          </div>
        </aside>

        {/* Mobil çekmece */}
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
              aria-label="Menüyü kapat"
            />
            <div className="absolute inset-y-0 left-0 w-[268px] overflow-y-auto bg-surface p-3 shadow-pop">
              <div className="mb-3 flex items-center justify-between px-1">
                <Logo size={26} />
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-3 hover:bg-sunken"
                  aria-label="Kapat"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              {nav}
              <div className="mt-4 border-t border-line pt-3">
                <Link
                  href="/"
                  className="flex min-h-[42px] items-center gap-2.5 rounded-xl px-3 text-[13.5px] text-ink-3"
                >
                  <ExternalLink size={16} aria-hidden />
                  Müşteri uygulaması
                </Link>
                <form action="/cikis" method="post">
                  <button
                    type="submit"
                    className="flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13.5px] text-danger"
                  >
                    <LogOut size={16} aria-hidden />
                    Çıkış yap
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        <main id="icerik" className="min-w-0 flex-1 p-4 sm:p-6">
          <StatusNotice status={business.status} />
          <PlanNotice business={business} />
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Abonelik durumu uyarısı.
 *
 * Deneme bitiş tarihi işletmenin göreceği tek yer burası olmamalı ama en
 * görünür yeri burası: son günlerde uyarı sertleşiyor. Ödeme gecikse bile
 * panel kapatılmıyor — işletmeyi kilitlemek, onun müşterisini cezalandırmak
 * olurdu (bkz. plans.ts `planActive`).
 */
function PlanNotice({ business }: { business: PanelBusiness }) {
  const durum = business.planStatus;
  if (!durum || durum === 'ACTIVE') return null;

  const kalan = trialDaysLeft(business.trialEndsAt ?? null);

  if (durum === 'TRIAL') {
    // İlk haftalarda hatırlatmaya gerek yok; son 14 gün kritik.
    if (kalan > 14) {
      return business.planChosen ? null : (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-[13.5px] text-ink-2">
          <span className="flex-1">
            Deneme sürenizde paket seçmediniz. Seçtiğinizde kapora gibi pakete
            bağlı özellikler açılır.
          </span>
          <Link href="/kayit/isletme/paket" className="font-medium text-brand-600 hover:underline">
            Paket seç
          </Link>
        </div>
      );
    }
    return (
      <div
        className={cn(
          'mb-4 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-[13.5px]',
          kalan <= 3 ? 'border-danger-line bg-danger-soft text-danger' : 'border-warn-line bg-warn-soft text-warn',
        )}
      >
        <Clock3 size={17} className="shrink-0" aria-hidden />
        <span className="flex-1">
          {kalan === 0
            ? 'Deneme süreniz doldu. Kesintisiz devam için paketinizi onaylayın.'
            : `Deneme sürenizin bitmesine ${kalan} gün kaldı.`}
        </span>
        <Link href="/kayit/isletme/paket" className="font-medium underline underline-offset-4">
          Paketleri gör
        </Link>
      </div>
    );
  }

  if (durum === 'PAST_DUE') {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
        <AlertTriangle size={17} className="shrink-0" aria-hidden />
        <span className="flex-1">
          <span className="font-semibold">Ödemeniz bekleniyor.</span> Randevularınız
          çalışmaya devam ediyor; lütfen destek ekibiyle iletişime geçin.
        </span>
      </div>
    );
  }

  return null;
}

/**
 * Onaylanmamış işletme uyarısı.
 *
 * Başvuru formu "onaydan sonra yayına alınır" diyor ama panel onaylanmış bir
 * işletmeyle birebir aynı görünüyordu: yeni kaydolan sahip hizmetlerini girip
 * müşteri bekliyor, hiçbir yerde işletmesinin henüz görünmediğini yazmıyordu.
 * Sessiz kalmanın bedeli, ilk gün terk eden bir işletme.
 */
function StatusNotice({ status }: { status: string }) {
  if (status === 'APPROVED') return null;

  const pending = status === 'PENDING';
  const Icon = pending ? Clock3 : AlertTriangle;
  return (
    <div
      role="status"
      className={cn(
        'mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-[13.5px] leading-relaxed',
        pending
          ? 'border-warn-line bg-warn-soft text-warn'
          : 'border-danger-line bg-danger-soft text-danger',
      )}
    >
      <Icon size={17} className="mt-0.5 shrink-0" aria-hidden />
      <p>
        {pending ? (
          <>
            <span className="font-semibold">Başvurunuz inceleniyor.</span> İşletmeniz onaylanana
            kadar müşteri tarafında görünmez ve randevu alamaz. Bu sırada hizmetlerinizi,
            personelinizi ve çalışma saatlerinizi hazırlayabilirsiniz.
          </>
        ) : status === 'REJECTED' ? (
          <>
            <span className="font-semibold">Başvurunuz onaylanmadı.</span> İşletmeniz yayında
            değil. Ayrıntı için destek ekibiyle iletişime geçin.
          </>
        ) : (
          <>
            <span className="font-semibold">İşletmeniz askıya alındı.</span> Yeni randevu
            alamazsınız. Ayrıntı için destek ekibiyle iletişime geçin.
          </>
        )}
      </p>
    </div>
  );
}

function BusinessSwitcher({
  business,
  businesses,
}: {
  business: PanelBusiness;
  businesses: PanelBusiness[];
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (businesses.length <= 1) {
    return (
      <div className="min-w-0">
        <p className="truncate text-[14.5px] font-semibold text-navy">{business.name}</p>
        <p className="text-[11.5px] text-ink-3">İşletme paneli</p>
      </div>
    );
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-[40px] max-w-[240px] items-center gap-2 rounded-xl px-2.5 text-left transition hover:bg-sunken"
      >
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold text-navy">{business.name}</span>
          <span className="block text-[11.5px] text-ink-3">İşletme değiştir</span>
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-[46px] z-50 w-72 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
        >
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/panel/${b.slug}`}
              role="option"
              aria-selected={b.id === business.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[14px] transition',
                b.id === business.id ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-sunken',
              )}
            >
              <span className="truncate">{b.name}</span>
              {b.status !== 'APPROVED' ? (
                <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] text-warn">
                  Onay bekliyor
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
