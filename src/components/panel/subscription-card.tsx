import Link from 'next/link';
import { Receipt, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { money, longDate } from '@/lib/format';
import { planByKey, PLAN_STATUS_LABEL, trialDaysLeft, type PlanStatus } from '@/lib/plans';
import { cn } from '@/lib/utils';

export type AbonelikFaturasi = {
  id: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date;
};

/**
 * İşletmenin kendi abonelik durumu.
 *
 * Ödeme bilgisi ORTAM DEĞİŞKENİNDEN geliyor, koda gömülü değil: platformun
 * IBAN'ı ve ünvanı repoda durmamalı ve dağıtımdan dağıtıma değişir.
 * Tanımlanmamışsa uydurma bir hesap göstermek yerine açıkça "tanımlanmadı"
 * yazıyor — yanlış hesaba yapılan havalenin geri dönüşü pahalı.
 */
export function SubscriptionCard({
  planKey,
  planStatus,
  planPrice,
  trialEndsAt,
  currentPeriodEnd,
  acikFatura,
  iban,
  unvan,
}: {
  planKey: string;
  planStatus: string;
  planPrice: number;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  acikFatura: AbonelikFaturasi | null;
  iban: string | null;
  unvan: string | null;
}) {
  const plan = planByKey(planKey);
  const secildi = planPrice > 0;
  const etiket = PLAN_STATUS_LABEL[planStatus as PlanStatus] ?? planStatus;
  const gun = trialDaysLeft(trialEndsAt);

  return (
    <Card>
      <CardHeader
        title="Abonelik"
        description="Paketiniz, ödeme durumunuz ve açık faturanız."
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-medium text-navy">
              {secildi ? plan.name : 'Paket seçilmedi'}
            </p>
            <p className="tnum mt-0.5 text-[13px] text-ink-3">
              {secildi ? `Aylık ${money(planPrice)}` : 'Kesintisiz devam için paket seçin'}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium',
              planStatus === 'ACTIVE'
                ? 'bg-success-soft text-success'
                : planStatus === 'PAST_DUE'
                  ? 'bg-danger-soft text-danger'
                  : 'bg-sunken text-ink-2',
            )}
          >
            {planStatus === 'ACTIVE' ? (
              <CheckCircle2 size={14} aria-hidden />
            ) : planStatus === 'PAST_DUE' ? (
              <AlertTriangle size={14} aria-hidden />
            ) : (
              <Clock size={14} aria-hidden />
            )}
            {etiket}
          </span>
        </div>

        {planStatus === 'TRIAL' && trialEndsAt ? (
          <p className="tnum text-[13.5px] text-ink-2">
            Deneme {gun > 0 ? `${gun} gün sonra` : ''} {longDate(trialEndsAt.toISOString().slice(0, 10))}{' '}
            tarihinde bitiyor.
            {secildi ? ' Ardından ilk faturanız oluşur.' : ''}
          </p>
        ) : null}

        {planStatus === 'ACTIVE' && currentPeriodEnd ? (
          <p className="tnum text-[13.5px] text-ink-2">
            Mevcut döneminiz {longDate(currentPeriodEnd.toISOString().slice(0, 10))} tarihinde
            bitiyor; bir sonraki fatura o gün oluşur.
          </p>
        ) : null}

        {!secildi ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/kayit/isletme/paket">Paket seç</Link>
          </Button>
        ) : null}

        {acikFatura ? (
          <div className="rounded-2xl border border-danger-line bg-danger-soft/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[14px] font-medium text-navy">
                <Receipt size={16} aria-hidden />
                Ödenmemiş fatura
              </p>
              <span className="tnum text-[16px] font-semibold text-navy">
                {money(acikFatura.amount)}
              </span>
            </div>
            <p className="tnum mt-1 text-[12.5px] text-ink-2">
              Dönem {longDate(acikFatura.periodStart.toISOString().slice(0, 10))} –{' '}
              {longDate(acikFatura.periodEnd.toISOString().slice(0, 10))} · son ödeme{' '}
              {longDate(acikFatura.dueAt.toISOString().slice(0, 10))}
            </p>

            <div className="mt-3 rounded-xl bg-surface/80 p-3 text-[13px]">
              {iban ? (
                <>
                  <p className="text-ink-2">Havale/EFT ile ödeyebilirsiniz:</p>
                  <p className="tnum mt-1 font-medium text-navy">{iban}</p>
                  {unvan ? <p className="mt-0.5 text-ink-3">{unvan}</p> : null}
                  <p className="mt-2 text-ink-3">
                    Açıklamaya işletme adınızı yazın. Ödemeniz görüldüğünde faturanız
                    kapanır ve size bildirim gider.
                  </p>
                </>
              ) : (
                // Uydurma bir hesap göstermek, yanlış hesaba yapılan havale demek.
                <p className="text-ink-3">
                  Ödeme bilgileri henüz tanımlanmadı. Lütfen bizimle iletişime geçin.
                </p>
              )}
            </div>

            <p className="mt-3 text-[12.5px] text-ink-3">
              Gecikme randevu almanızı engellemez; hizmetiniz kesintisiz sürer.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
