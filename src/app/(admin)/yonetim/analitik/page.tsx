import type { Metadata } from 'next';
import { funnels, oran, type Funnels } from '@/server/analytics';
import { Card, CardHeader, CardBody } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Analitik' };
export const dynamic = 'force-dynamic';

/**
 * İki taraflı huni (T15).
 *
 * Arz ve talep yan yana duruyor çünkü asıl soru ikisinin ORANI: rezervasyon
 * sayısı artarken arz tarafı aktifleşmiyorsa büyüme sahte.
 */
export default async function AnalyticsPage() {
  const f = await funnels(30);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Analitik</h1>
        <p className="mt-0.5 text-[13.5px] text-ink-3">Son {f.gunSayisi} gün</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Arz hunisi"
            description="İşletme başvurudan ilk randevusuna kadar."
          />
          <CardBody>
            <Huni
              adimlar={[
                { etiket: 'Başvuru', deger: f.arz.basvuru },
                { etiket: 'Onaylandı', deger: f.arz.onaylanan },
                { etiket: 'Kurulum tamam', deger: f.arz.kurulumTamam, ipucu: 'Hizmet ve çalışma saati tanımlı' },
                { etiket: 'İlk randevusunu aldı', deger: f.arz.ilkRandevuAlan },
              ]}
            />
            <Not>
              Kurulumu tamamlamayan işletme rezervasyon alamaz. Onay ile kurulum
              arasındaki düşüş, en pahalı kayıp: işletme kaydolmuş ama hiç
              çalışmamış demek.
            </Not>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Talep hunisi"
            description="Randevudan gelmeye kadar."
          />
          <CardBody>
            <Huni
              adimlar={[
                { etiket: 'Randevu', deger: f.talep.toplam },
                { etiket: 'Kapora başlatıldı', deger: f.talep.kaporaBaslayan, ipucu: '3DS’e yönlendirilen' },
                { etiket: 'Kapora ödendi', deger: f.talep.kaporaOdenen },
                { etiket: 'Tamamlandı', deger: f.talep.tamamlanan },
              ]}
            />
            <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
              <Kutu etiket="Gelmedi" deger={f.talep.gelmeyen} toplam={f.talep.toplam} tone="danger" />
              <Kutu etiket="İptal" deger={f.talep.iptal} toplam={f.talep.toplam} tone="warn" />
            </div>
            <Not>
              Ziyaret sayısı ölçülmüyor: sayfa görüntüleme takibi çerez ve açık
              rıza gerektiriyor, KVKK yüzeyini genişletmemek için kapsam dışı
              bırakıldı. Bu yüzden huni ziyaretten değil randevudan başlıyor.
            </Not>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Huni({
  adimlar,
}: {
  adimlar: { etiket: string; deger: number; ipucu?: string }[];
}) {
  const ilk = adimlar[0]?.deger ?? 0;
  return (
    <ol className="space-y-2.5">
      {adimlar.map((a, i) => {
        const yuzde = oran(a.deger, ilk);
        const genislik = ilk > 0 ? Math.max((a.deger / ilk) * 100, 2) : 2;
        return (
          <li key={a.etiket}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] font-medium text-navy">{a.etiket}</span>
              <span className="tnum text-[13.5px] text-ink-2">
                {a.deger}
                {i > 0 && yuzde !== null ? (
                  <span className="ml-1.5 text-[12.5px] text-ink-3">%{yuzde}</span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${genislik}%` }} />
            </div>
            {a.ipucu ? <p className="mt-1 text-[12px] text-ink-3">{a.ipucu}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

function Kutu({
  etiket,
  deger,
  toplam,
  tone,
}: {
  etiket: string;
  deger: number;
  toplam: number;
  tone: 'danger' | 'warn';
}) {
  const yuzde = oran(deger, toplam);
  return (
    <div className={`rounded-xl border p-3 ${tone === 'danger' ? 'border-danger-line bg-danger-soft' : 'border-warn-line bg-warn-soft'}`}>
      <p className={`text-[12.5px] ${tone === 'danger' ? 'text-danger' : 'text-warn'}`}>{etiket}</p>
      <p className={`tnum mt-0.5 text-[18px] font-semibold ${tone === 'danger' ? 'text-danger' : 'text-warn'}`}>
        {deger}
        {yuzde !== null ? <span className="ml-1 text-[13px] font-normal">%{yuzde}</span> : null}
      </p>
    </div>
  );
}

function Not({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 border-t border-line pt-3 text-[12.5px] leading-relaxed text-ink-3">
      {children}
    </p>
  );
}

export type { Funnels };
