-- Çakışan randevulara karşı ATOMİK koruma.
--
-- SORUN: `slotKey` personel + tarih + BAŞLANGIÇ DAKİKASI'ndan oluşuyor.
-- 10:00–11:00 ile 10:30–11:30 farklı anahtarlar üretir, yani benzersizlik
-- kısıtı bu ikisini ayırt etmez. Transaction içinde çakışma sorgusu var ama
-- PostgreSQL varsayılanı READ COMMITTED: iki eşzamanlı transaction birbirinin
-- henüz yazılmamış kaydını göremez, ikisi de sorguyu boş görüp ikisi de yazar.
-- Sonuç: aynı personele üst üste binen iki randevu.
--
-- ÇÖZÜM: aralık dışlama kısıtı (exclusion constraint). Aynı personelin aynı
-- gününde [startMin, blockEnd) aralıkları ÖRTÜŞEN iki aktif kayıt olamaz.
-- Kural veritabanında olduğu için hangi yoldan yazılırsa yazılsın geçerli:
-- uygulama, panel, ileride eklenecek içe aktarma ya da elle SQL.
--
-- blockEnd (bitiş + tampon) kullanılıyor, endMin değil: uygulamadaki çakışma
-- sorgusu da tamponu hesaba katıyor (bkz. reservations.ts), ikisi aynı
-- sözleşmeyi konuşmalı.
--
-- WHERE status <> 'CANCELLED': iptal edilen kayıt saati serbest bırakıyor
-- (bkz. ACTIVE_STATUSES). NO_SHOW ve COMPLETED saati DOLU sayar; o saat
-- gerçekten kullanıldı.
--
-- btree_gist gerekiyor çünkü gist indeksi tek başına "=" karşılaştırmasını
-- staffId/date gibi skaler sütunlarda desteklemiyor.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_personel_cakisma"
  EXCLUDE USING gist (
    "staffId" WITH =,
    "date" WITH =,
    int4range("startMin", "blockEnd") WITH &&
  )
  WHERE (status <> 'CANCELLED');
