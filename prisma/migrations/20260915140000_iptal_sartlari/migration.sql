-- İptal şartlarını randevuya DONDUR ve iptal edeni ayrıştır.
--
-- SORUN 1: kapora tutarı randevuya kaydediliyordu ama iade süresi
-- kaydedilmiyordu. İptalde işletmenin O ANKİ `depositRefundHours` değeri
-- okunuyordu. İşletme ayarı 24 saatten 72'ye çıkardığında, ayar
-- değişmeden önce alınmış randevuların şartı da geriye dönük değişiyordu:
-- müşteri kabul ettiğinden farklı bir kuralla karşılaşıyordu.
--
-- SORUN 2: aynı iptal hesabı hem müşteriye hem işletmeye uygulanıyordu.
-- İşletme randevuyu son anda iptal ettiğinde müşterinin kaporası
-- FORFEITED oluyordu — yani işletmenin iptali müşteriyi cezalandırıyordu.
--
-- Varsayılan 0: geçmiş kayıtlar için "iade süresi yok" en güvenli varsayım
-- değil, en TUTARLI olan — 0 saat, "randevu başlayana kadar iade edilir"
-- demek ve müşteri lehine.
ALTER TABLE "Reservation" ADD COLUMN "depositRefundHours" INTEGER NOT NULL DEFAULT 0;

-- CUSTOMER | BUSINESS | SYSTEM. NULL: henüz iptal edilmemiş.
ALTER TABLE "Reservation" ADD COLUMN "cancelledBy" TEXT;
