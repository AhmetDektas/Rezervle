-- Keşfet'te fiyat sıralaması için en düşük aktif hizmet fiyatı.
--
-- SORUN: "En uygun fiyat" sıralaması SAYFA ÇEKİLDİKTEN SONRA, bellekte
-- yapılıyordu. Önce "önerilen" sırasıyla 20 kayıt alınıyor, sonra o 20 kayıt
-- fiyata göre diziliyordu. Ankara'nın en ucuz işletmesi ikinci sayfadaysa
-- listenin başında hiç görünmüyordu — yani sıralama, adı dışında hiçbir şey
-- yapmıyordu.
--
-- Çözüm sıralamayı veri sorgusuna taşımak. İlişkili tablodaki MIN(price)
-- üzerinden sıralamak Prisma ile mümkün olmadığı için değer işletme satırında
-- tutuluyor ve hizmet yazmalarında tazeleniyor (bkz. server/pricing.ts).
ALTER TABLE "Business" ADD COLUMN "minPrice" INTEGER NOT NULL DEFAULT 0;

-- Mevcut veriyi doldur: aktif hizmeti olmayan işletmede 0 kalır.
UPDATE "Business" b
SET "minPrice" = COALESCE(
  (SELECT MIN(s.price) FROM "Service" s WHERE s."businessId" = b.id AND s.active = true),
  0
);

-- Sıralama her keşfet sorgusunda kullanılıyor.
CREATE INDEX "Business_minPrice_idx" ON "Business"("minPrice");
