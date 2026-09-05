import 'server-only';
import { releaseExpiredJob } from './release-expired';
import { reminderJob } from './reminders';

/**
 * İş kayıt noktası.
 *
 * `defineJob` kendini kayıt defterine ekliyor ama yalnızca modül IMPORT
 * edilirse. Bu dosya olmadan worker "hiç iş tanımlı değil" diye açılmadan
 * kapanırdı — sessiz değil, ama yine de kolayca gözden kaçacak bir bağ.
 */
export { releaseExpiredJob, reminderJob };

/**
 * Belirli aralıkla kendiliğinden çalışan işler.
 *
 * Tekrarlayan iş tanımı BullMQ'da kuyruğa yazılıyor ve aynı `jobId` ile
 * yeniden eklenmesi zararsız: worker her açıldığında çağrılabilir, kopya
 * zamanlama oluşmaz.
 */
export async function scheduleRecurring(): Promise<void> {
  // Ödeme süresi 15 dakika; dakikada bir tarama, terk edilen saati en geç
  // bir dakika gecikmeyle serbest bırakıyor. Daha sık taramak, boşta dönen
  // sorgu sayısını gereksiz artırırdı.
  await releaseExpiredJob.schedule(60_000, {});

  // Hatırlatma penceresi 10 dakika tolerans taşıyor; 5 dakikada bir tarama
  // hiçbir randevuyu atlamıyor ve pencereyi iki kez yakalasa bile
  // reminderSentAt ikinci gönderimi engelliyor.
  await reminderJob.schedule(5 * 60_000, {});
}
