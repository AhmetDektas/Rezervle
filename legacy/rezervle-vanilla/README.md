# Rezervle

İşletme için **rezervasyon takvimi** ve **ciro takibi**. Başka bir şey yok.

İki kural üzerine kurulu:

1. **Her rezervasyon aynı kapıdan geçer.** Çakışan bir kayıt hiçbir yoldan içeri
   giremez — formdan da, takvimde sürükleyerek de, sonradan bağlanacak uygulamadan da.
2. **Ciro elle girilmez.** Kayıtlardan hesaplanır. Doldurmayı unutabileceğin bir alan yok.

---

## Çalıştırma

```bash
node dev-server.js
```

`http://localhost:5173`. Bağımlılık yok, derleme adımı yok — `index.html` doğrudan
da açılabilir.

Tek dosyaya paketlemek için:

```bash
node build.js
```

- `dist/rezervle.html` — çift tıklayıp açılabilen tek parça sürüm (~104 KB)
- `dist/artifact.html` — gömülü ortamlar için gövde parçası

---

## Ekranlar

| Ekran | İşi |
|---|---|
| **Takvim** | Günün akışı. Kaynak başına kolon, sürükle-bırak taşıma, çakışma engeli, boş alana tıklayıp kayıt açma. |
| **Rezervasyonlar** | Tüm kayıtlar. Arama, tarih ve durum filtresi, CSV. |
| **Müşteriler** | Kim, ne sıklıkla, ne kadar. Sadık / kaybolan / no-show riski segmentleri. |
| **Ciro** | Dönem seçimi, günlük sütun grafiği, hizmet–kaynak–kanal kırılımı, kaçan para. |
| **Ayarlar** | Kaynaklar, hizmet ve fiyatlar, çalışma saatleri, hatırlatma. |

---

## Dosyalar

```
index.html            Yükleme sırası burada
assets/css/app.css    Token'lar ve tüm bileşenler (tek dosya)
assets/js/core.js     Yardımcılar + rezervasyon motoru + ciro hesabı + durum
assets/js/seed.js     Örnek veri (tohumlu rastgele — hep aynı tabloyu verir)
assets/js/ui.js       Bildirim, pencere, çekmece, grafik, rezervasyon formu
assets/js/views.js    Beş ekran
assets/js/app.js      Kabuk ve yönlendirme
```

---

## Tasarım kararı

**Arayüz renksiz, renk veriye ayrılmış.** Seçili ve aktif durum mürekkep siyahı;
yeşil yalnızca para, kırmızı yalnızca kayıp, sarı yalnızca bekleyen demektir.
Ekranda gördüğün her renk bir bilgi taşır, süs değildir.

Kart yığını yok — bölgeleri ince çizgi ve boşluk ayırır. Bütün sayılar, saatler ve
tutarlar IBM Plex Mono ve hizalı; sütunlar birbirini tutar.

Kontrast açık temada 5,1–6,5, koyu temada 5,0–8,3 (eşik 4,5). Dokunmatik cihazda
her hedef en az 42px.

---

## Veri modeli

```js
Reservation {
  id, customerId, serviceId, resourceId,
  date: 'YYYY-MM-DD', start, end,   // gün içi dakika (0–1440) — saat dilimi derdi yok
  status: pending | confirmed | arrived | done | noshow | cancelled,
  channel: phone | walkin | whatsapp | online,
  price, deposit: { amount, charged, chargeable }, note
}
```

Durum `localStorage`'da (`rezervle.v2`). Ayarlar > Veri'den sıfırlanır.

`channel: 'online'` alanı, sonradan bağlanacak müşteri uygulaması için hazır:
o taraf da `RZ.store.add()` çağıracak, yani aynı çakışma kontrolünden geçecek.

---

## Sonraki adım

Sunucu tarafı ve kimlik doğrulama, gerçek SMS sağlayıcısı, sanal POS (kapora için
kart saklama), çok şube. Müşteri uygulaması bu çekirdeğin üstüne bağlanır.

`_eski/` klasöründe önceki sürüm duruyor; gerekmiyorsa silinebilir.
