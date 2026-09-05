import 'server-only';
import { Queue } from 'bullmq';
import { redisConnection, definedJobs } from '@/worker/define-job';
import { logError } from './log';

/**
 * Kuyruk sağlığı (T14 / S8-1).
 *
 * Kuyruk sessizdir: iş başarısız olur, yeniden denenir, tükenir ve kimse
 * fark etmez. GAP-1 kararında bildirim hatalarını kuyruğa düşürmeye karar
 * verdik — bu ekran o kararın zorunlu eşlikçisi. Görünürlük olmadan "hataya
 * dayanıklı" demek, "hatayı gizliyoruz" demenin kibar hâli olurdu.
 *
 * Tükenmiş işler silinmiyor (`removeOnFail: false`), yani ölü mektup kutusu
 * kuyruğun `failed` listesinin kendisi.
 */

export type QueueStat = {
  name: string;
  bekleyen: number;
  calisan: number;
  /** Yeniden denemeleri tükenmiş işler: ölü mektup. */
  olu: number;
  gecikmis: number;
};

export type QueueHealth = {
  /** Redis okunamadıysa false; sayılar bu durumda anlamsız. */
  erisilebilir: boolean;
  kuyruklar: QueueStat[];
  toplamOlu: number;
  /** Eşik aşıldıysa yönetim panelinde uyarı gösterilir. */
  alarm: boolean;
};

/**
 * Alarm eşiği.
 *
 * Sıfır olsaydı tek bir geçici SMTP arızası bile alarm üretir ve alarm kısa
 * sürede görmezden gelinen bir kırmızı nokta hâline gelirdi. 5, "tekil arıza
 * değil, süregelen bir sorun" demek için yeterince yüksek.
 */
export const OLU_MEKTUP_ESIGI = 5;

export async function queueHealth(): Promise<QueueHealth> {
  const isler = definedJobs();
  if (isler.length === 0) {
    return { erisilebilir: true, kuyruklar: [], toplamOlu: 0, alarm: false };
  }

  try {
    const kuyruklar = await Promise.all(
      isler.map(async (is) => {
        const q = new Queue(is.name, { connection: redisConnection() });
        const sayim = await q.getJobCounts('waiting', 'active', 'failed', 'delayed');
        return {
          name: is.name,
          bekleyen: sayim['waiting'] ?? 0,
          calisan: sayim['active'] ?? 0,
          olu: sayim['failed'] ?? 0,
          gecikmis: sayim['delayed'] ?? 0,
        };
      }),
    );
    const toplamOlu = kuyruklar.reduce((t, k) => t + k.olu, 0);
    return { erisilebilir: true, kuyruklar, toplamOlu, alarm: toplamOlu >= OLU_MEKTUP_ESIGI };
  } catch (err) {
    // Redis erişilemiyorsa ekran "bilinmiyor" demeli; sıfır göstermek
    // "her şey yolunda" demenin yanlış yolu olurdu.
    logError({ action: 'queueHealth' }, err);
    return { erisilebilir: false, kuyruklar: [], toplamOlu: 0, alarm: false };
  }
}
