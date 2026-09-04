import type { Metadata } from 'next';
import Link from 'next/link';
import { LogOut, LayoutDashboard, Shield, CalendarCheck, Heart, Bell } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/server/auth';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { ProfileForm } from '@/components/shell/profile-form';
import { ROLE_LABEL } from '@/lib/constants';

export const metadata: Metadata = { title: 'Profilim' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser('/profil');
  const [profile, counts] = await Promise.all([
    prisma.customerProfile.findUnique({ where: { userId: user.id } }),
    prisma.$transaction([
      prisma.reservation.count({ where: { customerId: user.id } }),
      prisma.favorite.count({ where: { userId: user.id } }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]),
  ]);

  const [reservations, favorites, unread] = counts;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-7">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} size={60} hue={Number(user.avatarSeed) * 37} />
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em]">{user.name}</h1>
          <p className="truncate text-[13.5px] text-ink-3">{user.email}</p>
          <p className="mt-0.5 text-[12.5px] text-brand-600">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-3">
        <Stat href="/randevularim" icon={CalendarCheck} value={reservations} label="Randevu" />
        <Stat href="/favorilerim" icon={Heart} value={favorites} label="Favori" />
        <Stat href="/bildirimler" icon={Bell} value={unread} label="Okunmamış" />
      </ul>

      {user.role !== 'CUSTOMER' ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {(user.role === 'OWNER' || user.role === 'STAFF') ? (
            <Button asChild variant="secondary">
              <Link href="/panel"><LayoutDashboard size={16} aria-hidden />İşletme paneli</Link>
            </Button>
          ) : null}
          {user.role === 'ADMIN' ? (
            <Button asChild variant="secondary">
              <Link href="/yonetim"><Shield size={16} aria-hidden />Yönetim paneli</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <Card className="mt-5">
        <CardHeader title="Hesap bilgileri" description="İletişim bilgileriniz randevu hatırlatmalarında kullanılır." />
        <CardBody>
          <ProfileForm
            email={user.email}
            initial={{
              name: user.name,
              phone: user.phone ?? '',
              city: profile?.city ?? 'Ankara',
              district: profile?.district ?? '',
              smsOptIn: profile?.smsOptIn ?? true,
              emailOptIn: profile?.emailOptIn ?? true,
            }}
          />
        </CardBody>
      </Card>

      <form action="/cikis" method="post" className="mt-5">
        <Button type="submit" variant="dangerGhost" full>
          <LogOut size={16} aria-hidden />
          Çıkış yap
        </Button>
      </form>
    </div>
  );
}

function Stat({
  href, icon: Icon, value, label,
}: { href: string; icon: React.ElementType; value: number; label: string }) {
  return (
    <li>
      <Link href={href} className="card card-hover flex flex-col items-center gap-1 px-2 py-4 text-center">
        <Icon size={18} className="text-brand-500" aria-hidden />
        <span className="tnum text-[19px] font-semibold text-navy">{value}</span>
        <span className="text-[12px] text-ink-3">{label}</span>
      </Link>
    </li>
  );
}
