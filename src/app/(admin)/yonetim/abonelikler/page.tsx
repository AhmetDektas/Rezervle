import type { Metadata } from 'next';
import Link from 'next/link';
import { Receipt, AlertTriangle, Wallet, CalendarClock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { StatCard } from '@/components/panel/stat-card';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { InvoiceActions } from '@/components/admin/subscription-actions';
import { money, longDate } from '@/lib/format';
import { planByKey } from '@/lib/plans';
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from '@/lib/subscription';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Abonelikler' };
export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const simdi = new Date();

  const [acik, sonOdenen, aktifSayisi, paketsizler] = await Promise.all([
    prisma.subscriptionInvoice.findMany({
      where: { status: 'DUE' },
      orderBy: { dueAt: 'asc' },
      include: { business: { select: { name: true, slug: true, planStatus: true } } },
    }),
    prisma.subscriptionInvoice.findMany({
      where: { status: 'PAID' },
      orderBy: { paidAt: 'desc' },
      take: 15,
      include: { business: { select: { name: true, slug: true } } },
    }),
    prisma.business.count({ where: { planStatus: 'ACTIVE' } }),
    // Denemesi bitmiş ama paket seçmemiş işletmeler: fatura kesilemiyor,
    // kimse aramazsa sessizce bedava kullanmaya devam ederler.
    prisma.business.findMany({
      where: {
        planStatus: { not: 'CANCELLED' },
        planPrice: { lte: 0 },
        trialEndsAt: { lte: simdi },
      },
      select: { id: true, name: true, slug: true, trialEndsAt: true },
      orderBy: { trialEndsAt: 'asc' },
    }),
  ]);

  const acikTutar = acik.reduce((t, f) => t + f.amount, 0);
  const gecikmis = acik.filter((f) => f.dueAt.getTime() < simdi.getTime());
  // Aylık yinelenen gelir: ödeyen işletmelerin dondurulmuş ücretleri.
  const aktifler = await prisma.business.findMany({
    where: { planStatus: 'ACTIVE' },
    select: { planPrice: true },
  });
  const mrr = aktifler.reduce((t, b) => t + b.planPrice, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Abonelikler</h1>
        <p className="mt-1 text-[14px] text-ink-2">
          Tahsilat havale/EFT ile yapılıyor: para hesaba geçtiğinde faturayı
          ödendi olarak işaretleyin. Kart otomatik tahsilatı için lisanslı ödeme
          kuruluşu sözleşmesi gerekiyor.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Wallet size={18} />}
          label="Aylık yinelenen gelir"
          value={money(mrr)}
          hint={`${aktifSayisi} ödeyen işletme`}
        />
        <StatCard
          icon={<Receipt size={18} />}
          label="Açık fatura"
          value={money(acikTutar)}
          hint={`${acik.length} fatura`}
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Vadesi geçmiş"
          value={String(gecikmis.length)}
          hint={gecikmis.length > 0 ? 'Aranmalı' : 'Yok'}
        />
        <StatCard
          icon={<CalendarClock size={18} />}
          label="Paket seçmemiş"
          value={String(paketsizler.length)}
          hint="Denemesi bitti, fatura kesilemiyor"
        />
      </div>

      <Card>
        <CardHeader title="Açık faturalar" description="Vadesi yakın olan üstte." />
        <CardBody>
          {acik.length === 0 ? (
            <EmptyState
              icon={<Receipt size={20} />}
              title="Açık fatura yok"
              description="Dönemi biten işletmeler için faturalar kendiliğinden kesilir."
            />
          ) : (
            <ul className="divide-y divide-line">
              {acik.map((f) => {
                const gecikti = f.dueAt.getTime() < simdi.getTime();
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/panel/${f.business.slug}`}
                          className="text-[14.5px] font-medium text-navy hover:text-brand-700"
                        >
                          {f.business.name}
                        </Link>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11.5px] font-medium',
                            gecikti ? 'bg-danger-soft text-danger' : 'bg-sunken text-ink-2',
                          )}
                        >
                          {gecikti ? 'Vadesi geçti' : 'Vade yaklaşıyor'}
                        </span>
                      </div>
                      <p className="tnum mt-0.5 text-[12.5px] text-ink-3">
                        {planByKey(f.planKey).name} · {longDate(f.periodStart.toISOString().slice(0, 10))}
                        {' – '}
                        {longDate(f.periodEnd.toISOString().slice(0, 10))} · son ödeme{' '}
                        {longDate(f.dueAt.toISOString().slice(0, 10))}
                      </p>
                    </div>
                    <span className="tnum shrink-0 text-[15px] font-semibold text-navy">
                      {money(f.amount)}
                    </span>
                    <InvoiceActions
                      invoiceId={f.id}
                      amount={f.amount}
                      businessName={f.business.name}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {paketsizler.length > 0 ? (
        <Card>
          <CardHeader
            title="Denemesi bitti, paket seçmemiş"
            description="Seçmediği bir ücreti borç yazmıyoruz; bu işletmeler aranmalı."
          />
          <CardBody>
            <ul className="divide-y divide-line">
              {paketsizler.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link
                    href={`/panel/${b.slug}`}
                    className="text-[14px] font-medium text-navy hover:text-brand-700"
                  >
                    {b.name}
                  </Link>
                  <span className="tnum text-[12.5px] text-ink-3">
                    deneme bitişi{' '}
                    {b.trialEndsAt ? longDate(b.trialEndsAt.toISOString().slice(0, 10)) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Son tahsilatlar" description="En son 15 ödeme." />
        <CardBody>
          {sonOdenen.length === 0 ? (
            <EmptyState
              icon={<Wallet size={20} />}
              title="Henüz tahsilat yok"
              description="Ödenmiş işaretlenen faturalar burada listelenir."
            />
          ) : (
            <ul className="divide-y divide-line">
              {sonOdenen.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-navy">{f.business.name}</p>
                    <p className="tnum mt-0.5 text-[12.5px] text-ink-3">
                      {f.paidAt ? longDate(f.paidAt.toISOString().slice(0, 10)) : '—'}
                      {f.paidNote ? ` · ${f.paidNote}` : ''}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-[14px] font-semibold text-navy">
                    {money(f.amount)}
                  </span>
                  <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11.5px] font-medium text-success">
                    {INVOICE_STATUS_LABEL['PAID' as InvoiceStatus]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
