import type { Metadata } from 'next';
import Link from 'next/link';
import { Store, Users, CalendarDays, Wallet, AlertTriangle, ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/db';
import { StatCard } from '@/components/panel/stat-card';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { money, ago, longDate } from '@/lib/format';
import { today, addDays } from '@/lib/time';
import { BUSINESS_STATUS_LABEL, type BusinessStatus } from '@/lib/constants';
import { queueHealth } from '@/server/queue-health';

export const metadata: Metadata = { title: 'Yönetim' };
export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const t = today();
  const from = addDays(t, -29);

  const [kuyruk, [businesses, pendingBusinesses, users, reservations, revenue, reported, recent]] =
    await Promise.all([
      queueHealth(),
      Promise.all([
      prisma.business.count(),
      prisma.business.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, createdAt: true, owner: { select: { name: true } } },
      }),
      prisma.user.count(),
      prisma.reservation.count({ where: { date: { gte: from, lte: t } } }),
      prisma.reservation.aggregate({
        where: { date: { gte: from, lte: t }, status: 'COMPLETED' },
        _sum: { finalPrice: true },
      }),
      prisma.review.count({ where: { status: 'REPORTED' } }),
      prisma.businessStatusHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { business: { select: { name: true, slug: true } }, actor: { select: { name: true } } },
      }),
      ] as const),
    ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Platform genel bakış</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">
          {longDate(from)} – {longDate(t)} arası hareketler
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="İşletme" value={String(businesses)} hint={`${pendingBusinesses.length} onay bekliyor`} icon={<Store size={16} />} />
        <StatCard label="Kullanıcı" value={String(users)} icon={<Users size={16} />} />
        <StatCard label="Randevu (30 gün)" value={String(reservations)} icon={<CalendarDays size={16} />} />
        <StatCard label="İşlem hacmi (30 gün)" value={money(revenue._sum.finalPrice ?? 0)} tone="money" icon={<Wallet size={16} />} />
      </div>

      {/* Kuyruk sessizdir: iş tükenir ve kimse fark etmez. GAP-1'de bildirim
          hatalarını kuyruğa düşürmeye karar verdik; bu uyarı o kararın
          zorunlu eşlikçisi (S8-1). */}
      {kuyruk.alarm ? (
        <div className="flex items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4">
          <AlertTriangle size={19} className="shrink-0 text-danger" aria-hidden />
          <p className="flex-1 text-[14px] text-danger">
            <span className="font-semibold">{kuyruk.toplamOlu} arka plan işi</span> yeniden
            denemeleri tükendikten sonra ölü mektup kutusunda bekliyor. Bildirimler ve ödeme
            temizliği etkilenmiş olabilir.
          </p>
        </div>
      ) : null}

      {!kuyruk.erisilebilir ? (
        <div className="flex items-center gap-3 rounded-2xl border border-warn-line bg-warn-soft p-4">
          <AlertTriangle size={19} className="shrink-0 text-warn" aria-hidden />
          <p className="flex-1 text-[14px] text-warn">
            Kuyruk durumu okunamadı (Redis erişilemiyor). Arka plan işleri şu anda
            çalışmıyor olabilir.
          </p>
        </div>
      ) : null}

      {reported > 0 ? (
        <Link
          href="/yonetim/degerlendirmeler"
          className="flex items-center gap-3 rounded-2xl border border-warn-line bg-warn-soft p-4 transition hover:bg-warn-soft/80"
        >
          <AlertTriangle size={19} className="shrink-0 text-warn" aria-hidden />
          <p className="flex-1 text-[14px] text-warn">
            <span className="font-semibold">{reported} değerlendirme</span> şikayet edildi ve inceleme bekliyor.
          </p>
          <ArrowRight size={16} className="text-warn" aria-hidden />
        </Link>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Onay bekleyen başvurular"
            description={pendingBusinesses.length === 0 ? 'Bekleyen başvuru yok' : `${pendingBusinesses.length} başvuru`}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/yonetim/isletmeler?durum=PENDING">
                  Tümü
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </Button>
            }
          />
          {pendingBusinesses.length === 0 ? (
            <CardBody>
              <p className="text-[13.5px] text-ink-3">Tüm başvurular değerlendirildi.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {pendingBusinesses.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-navy">{b.name}</p>
                    <p className="text-[12.5px] text-ink-3">
                      {b.owner.name} · {ago(b.createdAt)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/yonetim/isletmeler?durum=PENDING">İncele</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Son durum değişiklikleri" description="Denetim izi" />
          <ul className="divide-y divide-line">
            {recent.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-navy">{h.business.name}</p>
                  <p className="text-[12.5px] text-ink-3">
                    {h.actor?.name ?? 'Sistem'} · {ago(h.createdAt)}
                  </p>
                </div>
                <Badge
                  tone={
                    h.toStatus === 'APPROVED' ? 'green' : h.toStatus === 'PENDING' ? 'amber' : 'red'
                  }
                >
                  {BUSINESS_STATUS_LABEL[h.toStatus as BusinessStatus]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
