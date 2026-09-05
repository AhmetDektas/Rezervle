import { describe, it, expect, vi, afterEach } from 'vitest';
import { run, DomainError } from '@/server/errors';

function captureErrors(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  return { lines, restore: () => spy.mockRestore() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('run() bağlamlı loglama', () => {
  it('beklenmeyen hatayı eylem adıyla ve yapılandırılmış olarak loglar', async () => {
    const cap = captureErrors();
    const result = await run(
      async () => {
        throw new Error('veritabanı düştü');
      },
      { action: 'testAction' },
    );
    cap.restore();

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('UNKNOWN');
    expect(cap.lines).toHaveLength(1);

    const parsed = JSON.parse(cap.lines[0]!) as Record<string, unknown>;
    expect(parsed['action']).toBe('testAction');
    expect(parsed['level']).toBe('error');
    expect((parsed['err'] as Record<string, unknown>)['message']).toBe('veritabanı düştü');
  });

  it('callback bağlamı zenginleştirebilir (kimlik çözüldüğü anda)', async () => {
    const cap = captureErrors();
    await run(
      async (ctx) => {
        ctx.userId = 'user_123';
        ctx.meta = { reservationId: 'rez_9' };
        throw new Error('sonradan patladı');
      },
      { action: 'zenginlestirilen' },
    );
    cap.restore();

    const parsed = JSON.parse(cap.lines[0]!) as Record<string, unknown>;
    expect(parsed['userId']).toBe('user_123');
    expect(parsed['meta']).toEqual({ reservationId: 'rez_9' });
  });

  it('DomainError loglanmaz — kullanıcıya gösterilebilir alan hatasıdır', async () => {
    const cap = captureErrors();
    const result = await run(
      async () => {
        throw new DomainError('Bu saat dolu.', 'SLOT_TAKEN');
      },
      { action: 'domainHatasi' },
    );
    cap.restore();

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe('Bu saat dolu.');
    expect(cap.lines).toHaveLength(0);
  });

  it('Next.js yönlendirme sinyali yutulmaz', async () => {
    const signal = Object.assign(new Error('redirect'), { digest: 'NEXT_REDIRECT;push;/giris' });
    await expect(
      run(
        async () => {
          throw signal;
        },
        { action: 'yonlendirme' },
      ),
    ).rejects.toBe(signal);
  });

  it('bağlam verilmezse bile hata loglanır', async () => {
    const cap = captureErrors();
    await run(async () => {
      throw new Error('bağlamsız');
    });
    cap.restore();

    const parsed = JSON.parse(cap.lines[0]!) as Record<string, unknown>;
    expect(parsed['action']).toBe('unknown');
  });
});
