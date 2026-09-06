/**
 * Bir randevudaki hizmet kalemlerinin toplamı.
 *
 * Saf fonksiyon: veritabanı bilmez. Müşteri ekranı, işletme paneli ve yazma
 * yolu aynı hesabı kullanmak zorunda — kural ikiye ayrılırsa ekranda yazan
 * süre ile takvimde ayrılan süre er geç birbirinden ayrışır ve üst üste binen
 * randevular doğar. Müsaitlik çekirdeğinin tek bir hizmet yerine düz bir
 * süre/tampon çifti alması sayesinde motorun kendisi değişmedi.
 */

export type ServiceLike = { durationMin: number; bufferMin: number; price: number };

export type BookingTotals = {
  /** Hizmet sürelerinin toplamı. */
  durationMin: number;
  /** Randevu sonrası hazırlık payı. */
  bufferMin: number;
  /** Kalem fiyatlarının toplamı (indirim öncesi). */
  price: number;
};

/**
 * Süreler toplanır, tampon YALNIZCA sonuncudan alınır.
 *
 * Tampon, hizmetin kendi süresi değil arkasından gelen toparlanma payı:
 * koltuğun temizlenmesi, aletin sterilize edilmesi. Aynı müşteri sırt sırta
 * iki hizmet alıyorsa aradaki toparlanma yaşanmaz, yalnızca en sonda yaşanır.
 * Her kalemin tamponunu toplamak müşteriye satılabilir saatleri sebepsiz
 * yere yer ve işletmenin gününü daraltırdı.
 */
export function bookingTotals(services: ServiceLike[]): BookingTotals {
  return {
    durationMin: services.reduce((t, s) => t + s.durationMin, 0),
    bufferMin: services.at(-1)?.bufferMin ?? 0,
    price: services.reduce((t, s) => t + s.price, 0),
  };
}

/**
 * Verilen sırayı koruyarak kayıtları eşler; biri eksikse null döner.
 *
 * Sıra önemli: kullanıcının seçtiği sıra hem ekranda listelenir hem de hangi
 * hizmetin tamponunun uygulanacağını belirler.
 */
export function orderServices<T extends { id: string }>(ids: string[], rows: T[]): T[] | null {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) return null;
    out.push(row);
  }
  return out.length === ids.length ? out : null;
}

/**
 * Bildirim ve liste satırlarında hizmetleri tek satırda anlatan etiket.
 *
 * SMS ve e-posta gövdesine hizmetlerin tamamını yazmak, üç hizmetlik bir
 * randevuda mesajı okunmaz hâle getiriyor ve SMS'i ikinci parçaya taşırıyor.
 * İlk hizmet + kalanın sayısı yeterli; tam liste zaten randevu detayında.
 */
export function serviceLabel(primaryName: string, count: number): string {
  return count > 1 ? `${primaryName} +${count - 1} hizmet` : primaryName;
}
