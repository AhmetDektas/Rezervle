import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// BullMQ ve ioredis Redis'e bağlanmaya çalışır; testte ikisini de taklit
// ediyoruz. Amaç kuyruğun kendisini değil, sarmalayıcının SÖZLEŞMESİNİ
// doğrulamak: hata yükseliyor mu, log bağlamı doğru mu, enqueue asıl işlemi
// düşürüyor mu.
const added = vi.hoisted(() => vi.fn());
const addFails = vi.hoisted(() => ({ value: false }));
const capturedProcessor = vi.hoisted(() => ({ fn: null as null | ((job: unknown) => Promise<void>) }));

vi.mock('bullmq', () => ({
  Queue: class {
    async add(...args: unknown[]) {
      if (addFails.value) throw new Error('Redis erişilemiyor');
      added(...args);
    }
  },
  Worker: class {
    constructor(_name: string, processor: (job: unknown) => Promise<void>) {
      capturedProcessor.fn = processor;
    }
    async close() {}
  },
}));

vi.mock('ioredis', () => ({ default: class {} }));

const { defineJob } = await import('@/worker/define-job');

function captureLogs(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const e = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    lines.push(a.map(String).join(' '));
  });
  const w = vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => {
    lines.push(a.map(String).join(' '));
  });
  return {
    lines,
    restore: () => {
      e.mockRestore();
      w.mockRestore();
    },
  };
}

beforeEach(() => {
  process.env['REDIS_URL'] = 'redis://localhost:6379';
  added.mockReset();
  addFails.value = false;
  capturedProcessor.fn = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('defineJob sözleşmesi', () => {
  it('işleyici hatası YÜKSELİR — BullMQ yeniden denemeyi bilmeli', async () => {
    const job = defineJob<{ id: string }>({
      name: 'patlayan',
      handler: async () => {
        throw new Error('işleyici patladı');
      },
    });
    job.start();

    const cap = captureLogs();
    await expect(
      capturedProcessor.fn!({ id: 'j1', data: { id: 'x' }, attemptsMade: 0 }),
    ).rejects.toThrow('işleyici patladı');
    cap.restore();

    // Hata hem loglanmalı hem yükselmeli: yalnızca loglamak yeniden denemeyi
    // sessizce iptal ederdi.
    expect(cap.lines).toHaveLength(1);
    const parsed = JSON.parse(cap.lines[0]!) as Record<string, unknown>;
    expect(parsed['action']).toBe('job:patlayan');
    expect(parsed['meta']).toMatchObject({ jobId: 'j1', attempt: 1 });
  });

  it('kuyruğa atma başarısızlığı asıl işlemi DÜŞÜRMEZ', async () => {
    const job = defineJob<{ v: number }>({ name: 'analitik', handler: async () => {} });
    addFails.value = true;

    const cap = captureLogs();
    await expect(job.enqueue({ v: 1 })).resolves.toBeUndefined();
    cap.restore();

    const parsed = JSON.parse(cap.lines[0]!) as Record<string, unknown>;
    expect(parsed['level']).toBe('warn');
    expect(parsed['action']).toBe('job:analitik:enqueue');
  });

  it('başarılı işleyici log üretmez', async () => {
    const seen: unknown[] = [];
    const job = defineJob<{ v: number }>({
      name: 'sessiz',
      handler: async (payload) => {
        seen.push(payload);
      },
    });
    job.start();

    const cap = captureLogs();
    await capturedProcessor.fn!({ id: 'j2', data: { v: 7 }, attemptsMade: 0 });
    cap.restore();

    expect(seen).toEqual([{ v: 7 }]);
    expect(cap.lines).toHaveLength(0);
  });

  it('işleyiciye geçen bağlam iş adını ve deneme sayısını taşır', async () => {
    let received: Record<string, unknown> | null = null;
    const job = defineJob<Record<string, never>>({
      name: 'baglamli',
      handler: async (_p, ctx) => {
        received = ctx as unknown as Record<string, unknown>;
      },
    });
    job.start();

    await capturedProcessor.fn!({ id: 'j3', data: {}, attemptsMade: 2 });

    expect(received).toMatchObject({ action: 'job:baglamli' });
    expect((received as unknown as { meta: Record<string, unknown> }).meta).toMatchObject({
      jobId: 'j3',
      attempt: 3,
    });
  });

  it('REDIS_URL yoksa açıkça hata verir', async () => {
    // Bağlantı modül düzeyinde önbelleğe alınıyor (uygulama için doğru: tek
    // bağlantı paylaşılır). Bu yüzden ortam değişkeni kontrolünü sınamak için
    // modülü sıfırlayıp taze içe aktarmak gerekiyor.
    vi.resetModules();
    delete process.env['REDIS_URL'];
    const fresh = await import('@/worker/define-job');

    expect(() => fresh.redisConnection()).toThrow('REDIS_URL');
  });

  it('bağlantı tek kez kurulur ve paylaşılır', async () => {
    vi.resetModules();
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    const fresh = await import('@/worker/define-job');

    expect(fresh.redisConnection()).toBe(fresh.redisConnection());
  });
});
