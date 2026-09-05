import 'server-only';
import { Queue, Worker, type Job, type JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { logError, logSideEffectFailure, type LogContext } from '@/server/log';

/**
 * Arka plan işleri için tek sözleşme.
 *
 * Üç iş bu iskeletin üstüne oturuyor: randevu hatırlatması, ödemesi
 * tamamlanmayan rezervasyonun serbest bırakılması ve başarısız bildirimin
 * yeniden gönderilmesi. Üçü de aynı şeylere ihtiyaç duyuyor — bağlantı,
 * yeniden deneme politikası, ölü mektup kuyruğu ve yapılandırılmış log — ve
 * her biri kendi kopyasını yazarsa biri unutulduğunda o iş sessizce ölür.
 *
 *   tanımla ──▶ Queue (üretici)  ──enqueue──▶ Redis
 *      │                                        │
 *      └──────▶ Worker (tüketici) ◀─────────────┘
 *                   │
 *                   ├─ başarı  ──▶ tamamlandı
 *                   └─ hata    ──▶ yeniden dene (üstel) ──▶ tükendi ──▶ ölü mektup
 *
 * Hata sözleşmesi `src/server/log.ts` ile aynı: kimlik evet, içerik hayır.
 * `run()` buraya uymuyor — worker'ın göstereceği kullanıcı ve döndüreceği
 * `ActionResult` yok; hata yükselmeli ki BullMQ yeniden denemeyi bilsin.
 */

/** Tüm işler tek Redis bağlantısını paylaşır. */
let connection: IORedis | null = null;

export function redisConnection(): IORedis {
  if (!connection) {
    const url = process.env['REDIS_URL'];
    if (!url) throw new Error('REDIS_URL tanımlı değil.');
    // BullMQ bloklayan komutlar kullanıyor; bu ayar olmadan uyarı veriyor.
    connection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return connection;
}

/**
 * Kuyruktan kullandığımız tek yüzey.
 *
 * BullMQ'nun `Queue.add` imzası iş adını `ExtractNameType<T, string>` koşullu
 * tipiyle daraltıyor; `T` jenerik olduğu sürece TypeScript bu koşulu çözemiyor
 * ve `string` atanamıyor. Bağımlı olduğumuz yüzeyi burada açıkça yazıp
 * daraltmayı tek bir yerde yapıyoruz — yük tipi (`T`) korunuyor.
 */
type QueueLike<T> = {
  add(name: string, data: T, opts?: JobsOptions): Promise<unknown>;
  upsertJobScheduler(
    id: string,
    repeat: { every: number },
    template?: { name?: string; data?: T },
  ): Promise<unknown>;
};

export type JobDefinition<T> = {
  /** Kuyruk adı. Log satırlarında `job:<name>` olarak görünür. */
  name: string;
  handler: (payload: T, ctx: LogContext) => Promise<void>;
  /** Varsayılan: 3 deneme, 5 saniyeden başlayan üstel bekleme. */
  attempts?: number;
  backoffMs?: number;
};

export type DefinedJob<T> = {
  name: string;
  /** İşi kuyruğa atar. Kuyruk erişilemezse hata YÜKSELMEZ; yan etki loglanır. */
  enqueue: (payload: T, options?: JobsOptions) => Promise<void>;
  /**
   * Belirli aralıkla kendiliğinden çalışacak şekilde kurar.
   *
   * BullMQ 6'da tekrarlayan iş `upsertJobScheduler` ile tanımlanıyor (v5'teki
   * `repeat` seçeneği kaldırıldı). "Upsert" olması önemli: worker her
   * açılışında çağrılabilir, kopya zamanlama oluşmaz.
   *
   * Kuyruk erişilemezse hata YÜKSELMEZ; `enqueue` ile aynı sözleşme.
   */
  schedule: (everyMs: number, payload: T) => Promise<void>;
  /** Worker'ı başlatır. Yalnızca worker sürecinde çağrılır. */
  start: () => Worker<T, void, string>;
  /**
   * İşin gövdesi, kuyruk olmadan.
   *
   * Testler için: bir işin doğru şeyi yaptığını sınamak, BullMQ'nun işi
   * teslim ettiğini sınamaktan farklı bir soru. İkisini ayırmazsak her iş
   * testi Redis'e ve zamanlamaya bağımlı hâle gelir.
   */
  run: (payload: T, ctx?: LogContext) => Promise<void>;
};

const registry: DefinedJob<unknown>[] = [];

export function defineJob<T>(def: JobDefinition<T>): DefinedJob<T> {
  const attempts = def.attempts ?? 3;
  const backoffMs = def.backoffMs ?? 5_000;
  let queue: QueueLike<T> | null = null;

  function q(): QueueLike<T> {
    if (!queue) {
      queue = new Queue<T, void, string>(def.name, {
        connection: redisConnection(),
        defaultJobOptions: {
          attempts,
          backoff: { type: 'exponential', delay: backoffMs },
          // Tükenmiş işler silinmez: ölü mektup kutusu bunlardan oluşuyor ve
          // S8-1'deki eşik alarmı bu sayıyı okuyor.
          removeOnFail: false,
          removeOnComplete: { count: 1000 },
        },
      }) as unknown as QueueLike<T>;
    }
    return queue;
  }

  const defined: DefinedJob<T> = {
    name: def.name,

    async enqueue(payload, options) {
      // Kuyruğa atmak hiçbir zaman asıl işlemi düşürmemeli. Randevu oluştu ve
      // analitik olayı kuyruğa atılamadıysa randevu yine de geçerlidir --
      // GAP-1'in dersi burada da geçerli.
      try {
        await q().add(def.name, payload, options);
      } catch (err) {
        logSideEffectFailure({ action: `job:${def.name}:enqueue` }, err);
      }
    },

    async schedule(everyMs, payload) {
      try {
        await q().upsertJobScheduler(`${def.name}-tekrar`, { every: everyMs }, {
          name: def.name,
          data: payload,
        });
      } catch (err) {
        logSideEffectFailure({ action: `job:${def.name}:schedule` }, err);
      }
    },

    async run(payload, ctx) {
      await def.handler(payload, ctx ?? { action: `job:${def.name}` });
    },

    start() {
      return new Worker<T, void, string>(
        def.name,
        async (job: Job<T>) => {
          const ctx: LogContext = {
            action: `job:${def.name}`,
            meta: { jobId: job.id ?? null, attempt: job.attemptsMade + 1 },
          };
          try {
            await def.handler(job.data, ctx);
          } catch (err) {
            // Loglayıp YENİDEN FIRLAT: BullMQ başarısızlığı görmeli ki
            // yeniden deneme ve ölü mektup mekanizması çalışsın.
            logError(ctx, err);
            throw err;
          }
        },
        { connection: redisConnection() },
      );
    },
  };

  registry.push(defined as DefinedJob<unknown>);
  return defined;
}

/** Tanımlı tüm işler. Worker girişi ve sağlık sayacı bunu okur. */
export function definedJobs(): readonly DefinedJob<unknown>[] {
  return registry;
}
