import type { Metadata } from 'next';
import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';
import { queueHealth, OLU_MEKTUP_ESIGI } from '@/server/queue-health';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Kuyruk' };
export const dynamic = 'force-dynamic';

/**
 * Arka plan işleri sayacı (T14 / S8-1).
 *
 * "Ölü mektup" = yeniden denemeleri tükenmiş iş. Bunlar silinmiyor
 * (`removeOnFail: false`) çünkü silinirse geriye bakıp neyin kaybolduğunu
 * anlamanın yolu kalmaz.
 */
export default async function QueuePage() {
  const saglik = await queueHealth();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Arka plan işleri</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">
          Hatırlatma, ödeme süre taraması ve bildirim yeniden denemeleri bu kuyruklardan geçer.
        </p>
      </div>

      {!saglik.erisilebilir ? (
        <div className="flex items-center gap-3 rounded-2xl border border-warn-line bg-warn-soft p-4">
          <AlertTriangle size={19} className="shrink-0 text-warn" aria-hidden />
          <p className="text-[14px] text-warn">
            Redis erişilemiyor; sayılar okunamadı. Sıfır göstermek “her şey yolunda” demenin
            yanlış yolu olurdu.
          </p>
        </div>
      ) : saglik.alarm ? (
        <div className="flex items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4">
          <AlertTriangle size={19} className="shrink-0 text-danger" aria-hidden />
          <p className="text-[14px] text-danger">
            Ölü mektup sayısı eşiğin ({OLU_MEKTUP_ESIGI}) üstünde. Tekil bir arıza değil,
            süregelen bir sorun olma ihtimali yüksek.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-success-line bg-success-soft p-4">
          <CheckCircle2 size={19} className="shrink-0 text-success" aria-hidden />
          <p className="text-[14px] text-success">Kuyruklar sağlıklı.</p>
        </div>
      )}

      <Card>
        <CardHeader title="Kuyruklar" description="Sayılar anlıktır; sayfayı yenileyerek güncellenir." />
        <CardBody>
          {saglik.kuyruklar.length === 0 ? (
            <EmptyState
              icon={<Inbox size={22} />}
              title="Kuyruk bilgisi yok"
              description="Tanımlı iş bulunamadı ya da bağlantı kurulamadı."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-ink-3">
                    <th className="py-2 pr-3 font-medium">İş</th>
                    <th className="py-2 pr-3 font-medium tnum">Bekleyen</th>
                    <th className="py-2 pr-3 font-medium tnum">Çalışan</th>
                    <th className="py-2 pr-3 font-medium tnum">Gecikmiş</th>
                    <th className="py-2 font-medium tnum">Ölü mektup</th>
                  </tr>
                </thead>
                <tbody>
                  {saglik.kuyruklar.map((k) => (
                    <tr key={k.name} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-navy">{k.name}</td>
                      <td className="py-2.5 pr-3 tnum text-ink-2">{k.bekleyen}</td>
                      <td className="py-2.5 pr-3 tnum text-ink-2">{k.calisan}</td>
                      <td className="py-2.5 pr-3 tnum text-ink-2">{k.gecikmis}</td>
                      <td className={`py-2.5 tnum ${k.olu > 0 ? 'font-semibold text-danger' : 'text-ink-2'}`}>
                        {k.olu}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
