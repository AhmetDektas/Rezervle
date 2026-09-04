# TODOS

Tasarım incelemesinde (28.08.2026) bilinçli olarak ertelenen işler.
Hepsi öneri; gereksiz bulduğunu sil.

## T1 — Takvimin mobil tasarımı (P2)

**Ne:** 900px altında takvim şu an masaüstü ızgarasının yatay kaydırılan hâli.
Mobil için ayrı bir görünüm gerekiyor: tek kaynak seçici + dikey saat listesi.

**Neden:** Saha kullanımının çoğu telefondan olacak. Yatay kaydırma çalışıyor ama
tasarlanmış değil; "yığılmış masaüstü" mobil tasarım sayılmaz.

**Artı:** Panelin en çok kullanılan ekranı telefonda gerçekten kullanılabilir olur.
**Eksi:** İkinci bir takvim görünümü bakım yükü demek.
**Bağımlılık:** Yok. `assets/js/views/calendar.js`.

## T2 — Sürükle-bırakın tam klavye karşılığı (P3)

**Ne:** Şu an randevu klavyeyle odaklanıp Enter ile açılıyor, saat detay
çekmecesinden değiştiriliyor. Tam karşılık: odaklı randevuyu ok tuşlarıyla taşımak.

**Neden:** Fareyle yapılabilen her şeyin klavye karşılığı olmalı. Mevcut çözüm
erişilebilir ama eşdeğer değil — daha yavaş.

**Artı:** Klavye kullanıcısı için taşıma da hızlanır.
**Eksi:** Ok tuşu davranışı takvim kaydırmasıyla çakışabilir, dikkatli kurgu ister.
**Bağımlılık:** Yok. `assets/js/views/calendar.js`.

## T3 — Değer kanıtı katsayılarının kendi verisiyle kalibrasyonu (P3)

**Ne:** "Bu ay Rezervle ne kazandırdı" kartındaki iki satır sektör ortalamasına
dayanıyor (hatırlatma no-show'u ~%40 azaltır, kampanya kazanımının yarısı sayılır).
Yeterli veri biriktiğinde işletmenin kendi hatırlatmalı/hatırlatmasız no-show
oranından hesaplanmalı.

**Neden:** Tahmini rakam şu an dürüstçe etiketli ama yine tahmin. Gerçek veriyle
hesaplanan bir rakam fatura tartışmasını tamamen bitirir.

**Artı:** İddia savunulabilirlikten kanıta geçer.
**Eksi:** En az 2-3 aylık veri gerektirir; o zamana kadar mevcut hâli kalmalı.
**Bağımlılık:** Hatırlatma gönderim kaydının tutulması (şu an sayaç var, kayıt yok).

---

## Kapsam dışı bırakılanlar (yapılmayacak, sebebiyle)

- **Figma maketindeki chatbot ve arkadaş haritası** — ankette hiç sorulmamış.
  Personel modülü %38 talep diye küçültüldü; bunlar %0 kanıtla duruyor.
- **"Sağlık" ve "Wedding" kategorileri** — diş/veteriner reklam yasağı nedeniyle
  ilk 18 ay kapsam dışı, projeksiyona da dahil değil.
- **Stok fotoğraflı kategori görselleri** — marka zayıflatır ve çevrimdışı çalışmaz;
  kategori gradyanları token renklerinden türetiliyor.
- **Markanın Figma paletine geçirilmesi** — Figma tarafı maket, kurulu ürün
  gerçekçi olan. İstenirse `--brand` token'ı tek noktadan değiştirilebilir.
