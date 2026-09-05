import 'server-only';

/**
 * Yapılandırılmış sunucu logu.
 *
 * Sözleşme: **kimlik evet, içerik hayır.** Loga yalnızca opak kimlikler
 * (`userId`, `reservationId`) ve sayısal/enum değerler girer; ad, telefon,
 * e-posta ve serbest metin asla girmez.
 *
 * Gerekçe: loglar da kişisel veri işleyen bir sistemdir. İçerik loglanmazsa
 * "verilerimi silin" talebi loglara uzanmaz — logda silinecek kişisel veri
 * yoktur, yalnızca veritabanından zaten silinecek bir kimlik vardır. Teşhis
 * kabiliyeti kaybolmaz: `userId` ile kaydı veritabanından bulursunuz.
 */
export type LogContext = {
  /** Ne yapılıyordu: `createReservation`, `registerAction` gibi. */
  action: string;
  /** Opak kimlik. Ad/e-posta değil. */
  userId?: string | null;
  /** Yalnızca kimlik, sayı, enum ve bayrak. Serbest metin ve iletişim bilgisi yasak. */
  meta?: Record<string, string | number | boolean | null | undefined>;
};

function serialize(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, ...(err.stack ? { stack: err.stack } : {}) };
  }
  return { name: 'NonError', message: String(err) };
}

function emit(level: 'error' | 'warn', context: LogContext, err: unknown): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    action: context.action,
    userId: context.userId ?? null,
    ...(context.meta ? { meta: context.meta } : {}),
    err: serialize(err),
  });
  if (level === 'error') console.error(line);
  else console.warn(line);
}

/** Beklenmeyen hata: akış kesildi. */
export function logError(context: LogContext, err: unknown): void {
  emit('error', context, err);
}

/**
 * Yan etki başarısız oldu ama asıl işlem başarılı.
 * Örnek: randevu oluştu, onay e-postası gönderilemedi.
 */
export function logSideEffectFailure(context: LogContext, err: unknown): void {
  emit('warn', context, err);
}
