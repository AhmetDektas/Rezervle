import { logError, type LogContext } from './log';

/** Kullanıcıya gösterilebilir alan hatası. Beklenmeyen hatalar asla
 *  doğrudan gösterilmez; loglanır ve genel mesaja çevrilir. */
export class DomainError extends Error {
  readonly code: string;
  constructor(message: string, code = 'DOMAIN') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; code?: string };

/**
 * Server action'ları saran ortak hata yakalayıcı.
 *
 * `context` isteğe bağlıdır ama beklenmeyen hatalarda tek teşhis kaynağıdır:
 * bağlamsız bir log satırı ("beklenmeyen hata") üç hafta sonra gelen
 * "randevum oluşmadı" şikayetini yeniden kurmaya yetmez. Bağlam yalnızca
 * eylem adı ve opak kimlik taşır — sözleşme için `log.ts`.
 */
export async function run<T>(
  fn: (ctx: LogContext) => Promise<T>,
  context?: LogContext,
): Promise<ActionResult<T>> {
  // Çoğu eylem oturumu `run` içinde çözüyor (`requireRole` çağrısı callback'in
  // ilk satırı). Bağlamı callback'e geçirerek kimliğin çözüldüğü anda
  // eklenmesini mümkün kılıyoruz: `ctx.userId = user.id`.
  const ctx: LogContext = context ?? { action: 'unknown' };
  try {
    const data = await fn(ctx);
    return { ok: true, data } as ActionResult<T>;
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message, code: err.code };
    if (err instanceof Error) {
      const named = ['AuthError', 'ForbiddenError'];
      if (named.includes(err.name)) return { ok: false, error: err.message, code: err.name };
      // Next.js yönlendirme/notFound sinyalleri hata gibi görünür; yutulmamalı.
      if ('digest' in err && typeof err.digest === 'string' && err.digest.startsWith('NEXT_')) {
        throw err;
      }
    }
    logError(ctx, err);
    return {
      ok: false,
      error: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
      code: 'UNKNOWN',
    };
  }
}
