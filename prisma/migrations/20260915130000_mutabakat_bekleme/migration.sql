-- Hak ediş / iade için "sağlayıcı teyidi bekleniyor" anı.
--
-- Önceden veritabanı REFUNDED/RELEASED yazıp sağlayıcıyı sonra çağırıyordu;
-- sağlayıcı hata dönerse yalnızca not değişiyor, durum sonuçlanmış kalıyordu.
-- Para hareket etmeden "iade edildi" diyen kayıtlar oluşuyordu.
--
-- Artık ara durum var (REFUND_PENDING / RELEASE_PENDING) ve bu sütun o
-- duruma geçiş anını tutuyor: tekrar deneme işi, ilk denemesi hâlâ süren
-- kayıtları dışarıda bırakmak için buna bakıyor.
ALTER TABLE "Payment" ADD COLUMN "settlementPendingAt" TIMESTAMP(3);
