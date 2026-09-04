import type { Metadata } from 'next';
import Link from 'next/link';
import { Wallet, ShieldCheck, Receipt } from 'lucide-react';
import { prisma } from '@/lib/db';
import { platformCommission } from '@/server/panel';
import { StatCard, BarRow } from '@/components/panel/stat-card';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { money, percent, longDate } from '@/lib/format';
import { today, addDays, startOfMonth } from '@/lib/time';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Komisyon geliri' };
export const dynamic = 'force-dynamic';

type Search = Promise<{ aralik?: string }>;

const RANGES = [
  { key: '30', label: 'Son 30 gün' },
  { key: '90', label: 'Son 90 gün' },
  { key: 'ay', label: 'Bu ay' },
];

export default async function CommissionPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const active = search.aralik ?? '30';
  const t = today();
  const from = active === 'ay' ? startOfMonth(t) : addDays(t, active === '90' ? -89 : -29);

  const [report, held] = await Promise.all([
    platformCommission(from, t),
    prisma.payment.aggregate({
      where: { settlementStatus: 'HELD' },
      _sum: { netAmount: true, commissionAmount: true },
      _count: { _all: true },
    }),
  ]);

  const top = report.businesses[0]?.commission ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Komisyon geliri</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            {longDate(from)} – {longDate(t)} · yalnızca hak edişi yazılan tahsilatlar
          </p>
        </div>
        <nav className="flex rounded-xl border border-line-strong bg-sunken p-1" aria-label="Tarih aralığı">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/yonetim/komisyon?aralik=${r.key}`}
              aria-current={active === r.key ? 'page' : undefined}
              className={cn(
                'flex min-h-[36px] items-center rounded-lg px-3 text-[13px] font-medium transition',
                active === r.key
                  ? 'bg-surface text-navy shadow-[0_1px_2px_rgba(11,31,58,.10)]'
                  : 'text-ink-3 hover:text-navy',
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Komisyon geliri"
          value={money(report.total)}
          hint={`${report.count} tahsilattan`}
          tone="money"
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="Aracılık edilen tutar"
          value={money(report.captured)}
          hint="Uygulamadan geçen toplam kapora"
          icon={<Receipt size={16} />}
        />
        <StatCard
          label="Ortalama komisyon oranı"
          value={percent(report.captured > 0 ? (report.total / report.captured) * 100 : 0, 1)}
          hint="Gerçekleşen"
        />
        <StatCard
          label="Bloke bekleyen"
          value={money((held._sum.netAmount ?? 0) + (held._sum.commissionAmount ?? 0))}
          hint={`${held._count._all} randevu · sonuçlanmadı`}
          icon={<ShieldCheck size={16} />}
        />
      </div>

      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <p className="text-[13.5px] leading-relaxed text-brand-700">
          <span className="font-semibold">Para akışı:</span> müşteri kaporayı öder, lisanslı
          ödeme kuruluşu tutarı ödeme anında böler. Komisyon platformun üye işyeri hesabına
          geçer, işletme payı randevu sonuçlanana kadar kuruluşta bloke kalır. Platform
          müşteri parasını hiçbir zaman kendi hesabında tutmaz. Zamanında iptallerde
          komisyon da iade edilir ve bu tabloya girmez.
        </p>
      </div>

      <Card>
        <CardHeader title="İşletmeye göre" description="En çok komisyon getiren işletmeler" />
        <CardBody>
          {report.businesses.length === 0 ? (
            <EmptyState
              title="Bu aralıkta komisyon geliri yok"
              description="Kapora paketi açık işletmelerde tahsilat oldukça burada görünür."
            />
          ) : (
            <ul className="divide-y divide-line">
              {report.businesses.map((b) => (
                <BarRow
                  key={b.slug}
                  label={b.name}
                  value={b.commission}
                  max={top}
                  right={`${money(b.commission)} · ${b.count} tahsilat`}
                  tone="success"
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
