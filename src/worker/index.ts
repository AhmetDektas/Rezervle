import 'server-only';
import type { Worker } from 'bullmq';
import { definedJobs, redisConnection } from './define-job';
// Isler kendini defineJob ile kaydediyor; kayit yalnizca modul import
// edilirse olusuyor. Bu import olmadan worker acilmadan kapanirdi.
import { scheduleRecurring } from './jobs';
import { logError } from '@/server/log';

/**
 * Worker süreci girişi.
 *
 * Web ile aynı imajdan, aynı barındırmada ikinci süreç olarak koşar. Bu
 * seçim (S9-1) tek dağıtım ve tek sürüm demek — web ile worker arasında
 * sürüm uyuşmazlığı yaşanmıyor. Bedeli: dağıtım her ikisini birden yeniden
 * başlatıyor, yani uçuştaki işler kesilme riski altında.
 *
 * Zarif kapanış bunun için var:
 *
 *   SIGTERM ──▶ yeni iş alma dur ──▶ uçuştakileri bitir ──▶ bağlantıyı kapat
 *                                          │
 *                                          └─ SHUTDOWN_TIMEOUT_MS aşılırsa
 *                                             zorla kapat (idempotens kayıtları
 *                                             ikinci savunma hattı)
 *
 * Zaman aşımı üst sınırı bilinçli: barındırma platformları SIGTERM'den sonra
 * sınırlı süre bekler ve sonra SIGKILL gönderir. Kendi sınırımızı onunkinden
 * kısa tutup kapanışı kontrollü bitiriyoruz.
 */

const SHUTDOWN_TIMEOUT_MS = Number(process.env['WORKER_SHUTDOWN_TIMEOUT_MS'] ?? 25_000);

export function startWorkers(): Worker[] {
  const jobs = definedJobs();
  if (jobs.length === 0) {
    throw new Error('Hiç iş tanımlı değil; worker açılmadan kapanırdı.');
  }
  const workers = jobs.map((j) => j.start());
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      action: 'worker:started',
      meta: { jobs: jobs.map((j) => j.name).join(','), count: jobs.length },
    }),
  );
  return workers;
}

/**
 * Kapanış: her worker'a "yeni iş alma" der ve uçuştakilerin bitmesini bekler.
 * `Worker.close()` varsayılan olarak zarif kapanır; zorlama yalnızca üst
 * sınır aşıldığında devreye girer.
 */
export async function shutdownWorkers(workers: Worker[]): Promise<void> {
  const graceful = Promise.all(workers.map((w) => w.close()));
  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), SHUTDOWN_TIMEOUT_MS),
  );

  const outcome = await Promise.race([graceful.then(() => 'done' as const), timeout]);

  if (outcome === 'timeout') {
    logError(
      { action: 'worker:shutdown', meta: { timeoutMs: SHUTDOWN_TIMEOUT_MS } },
      new Error('Zarif kapanış süresi aşıldı; işler zorla kesiliyor.'),
    );
    await Promise.all(workers.map((w) => w.close(true)));
  }

  await redisConnection().quit();
}

/** Süreç doğrudan çalıştırıldığında (npm run worker). */
export function main(): void {
  const workers = startWorkers();
  // Tekrarlayan işleri kur. Hata kapanışa sebep olmamalı: tarama işi
  // gecikirse saatler biraz geç serbest kalır, worker'ın hiç açılmaması
  // ise tüm arka plan işlerini durdururdu.
  void scheduleRecurring().catch((err: unknown) =>
    logError({ action: 'worker:scheduleRecurring' }, err),
  );
  let closing = false;

  const stop = (signal: string) => {
    if (closing) return; // ikinci sinyal kapanışı bozmasın
    closing = true;
    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        action: 'worker:shutdown',
        meta: { signal },
      }),
    );
    shutdownWorkers(workers)
      .then(() => process.exit(0))
      .catch((err) => {
        logError({ action: 'worker:shutdown' }, err);
        process.exit(1);
      });
  };

  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}
