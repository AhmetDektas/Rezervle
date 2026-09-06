-- CreateTable
CREATE TABLE "ReservationService" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "bufferMin" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "ReservationService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationService_serviceId_idx" ON "ReservationService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationService_reservationId_serviceId_key" ON "ReservationService"("reservationId", "serviceId");

-- AddForeignKey
ALTER TABLE "ReservationService" ADD CONSTRAINT "ReservationService_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationService" ADD CONSTRAINT "ReservationService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mevcut randevular icin tek kalemlik liste uretilir; aksi halde randevu
-- detayi bu kayitlarda bos hizmet listesi gosterirdi.
--
-- Sure ve tutar hizmetin BUGUNKU halinden degil, randevunun kendi kayitli
-- degerlerinden okunuyor: endMin-startMin gercekten ayrilan sure,
-- blockEnd-endMin gercekten uygulanan tampon, price gercekten yazilan tutar.
-- Hizmet o gunden beri degistiyse dogru olan bu. Ad icin gecmise donuk kayit
-- yok; hizmetin bugunku adi kullaniliyor.
INSERT INTO "ReservationService"
  ("id", "reservationId", "serviceId", "sortOrder", "name", "durationMin", "bufferMin", "price")
SELECT
  'rs_' || r."id",
  r."id",
  r."serviceId",
  0,
  s."name",
  GREATEST(r."endMin" - r."startMin", 0),
  GREATEST(r."blockEnd" - r."endMin", 0),
  r."price"
FROM "Reservation" r
JOIN "Service" s ON s."id" = r."serviceId";
