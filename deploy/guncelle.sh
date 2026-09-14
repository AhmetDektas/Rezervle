#!/bin/bash
#
# Rezzerv — canlı sürümü güncelle.
#
# KENDİNİ ARKA PLANA ALIR. Önceki sürüm doğrudan SSH oturumunda koşuyordu ve
# oturum zaman aşımına uğradığında betik `systemctl restart` ile derleme
# arasında ölüyordu: servis "deactivating" durumunda asılı kaldı, site bir
# süre cevap vermedi. Artık `setsid` ile oturumdan koparılıyor; bağlantı
# düşse de dağıtım sürüyor.
#
#   /root/guncelle.sh            → arka planda başlatır, log yolunu yazar
#   /root/guncelle.sh --takip    → başlatır ve logu izler
#   /root/guncelle.sh --durum    → süren dağıtım var mı, son satırlar ne
#
# `sunucu-kur.sh` ilk kurulum içindir; bu betik yalnızca yeni sürümü alır ve
# .env'e DOKUNMAZ (AUTH_SECRET ve veritabanı parolası orada duruyor).
set -euo pipefail

UYGULAMA=/opt/rezzerv
HAZIRLIK=/opt/rezzerv-hazirlik   # bağımlılıklar önce buraya kurulur (bkz. bagimliliklari_kur)
LOG=/root/rezzerv-dagitim.log
KILIT=/run/rezzerv-dagitim.pid

# --- durum sorgusu -------------------------------------------------------
if [ "${1:-}" = "--durum" ]; then
  if [ -f "$KILIT" ] && kill -0 "$(cat "$KILIT")" 2>/dev/null; then
    echo "DAĞITIM SÜRÜYOR (pid $(cat "$KILIT"))"
  else
    echo "süren dağıtım yok"
  fi
  tail -15 "$LOG" 2>/dev/null || true
  exit 0
fi

# --- kendini arka plana al ----------------------------------------------
if [ "${REZZERV_ARKAPLAN:-}" != "1" ]; then
  if [ -f "$KILIT" ] && kill -0 "$(cat "$KILIT")" 2>/dev/null; then
    echo "Zaten bir dağıtım sürüyor (pid $(cat "$KILIT")). --durum ile bakın."
    exit 1
  fi
  REZZERV_ARKAPLAN=1 setsid "$0" >/dev/null 2>&1 &
  echo "Dağıtım arka planda başlatıldı."
  echo "  izlemek için : tail -f $LOG"
  echo "  durum        : $0 --durum"
  if [ "${1:-}" = "--takip" ]; then
    sleep 2
    tail -f "$LOG"
  fi
  exit 0
fi

echo $$ > "$KILIT"
trap 'rm -f "$KILIT"' EXIT

exec >>"$LOG" 2>&1
echo "=== $(date) güncelleme ==="
cd "$UYGULAMA"

# Git, sahibi farklı olan bir depoda root ile çalışmayı reddediyor
# ("dubious ownership"). Dizin artık `rezzerv` kullanıcısına ait ama dağıtım
# root olarak koşuyor, dolayısıyla `git fetch` bu istisna olmadan hiç
# çalışmıyor. Canlıda tam olarak bu görüldü:
#
#   fatal: detected dubious ownership in repository at '/opt/rezzerv'
git config --global --add safe.directory "$UYGULAMA" 2>/dev/null || true

ONCEKI=$(git rev-parse --short HEAD)
# Kilit dosyasının ÖNCEKİ parmak izi: bağımlılıkları gerçekten yeniden kurmak
# gerekip gerekmediğini bundan anlıyoruz.
KILIT_ONCE=$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1)

git fetch --quiet origin
git reset --hard origin/main --quiet
YENI=$(git rev-parse --short HEAD)
KILIT_SONRA=$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1)
echo "sürüm: $ONCEKI → $YENI"

# Bağımlılıkları KURULU AĞACIN YANINA kurar, sonunda yer değiştirir.
#
# `npm ci` işe node_modules'ü SİLEREK başlıyor. Ama eski sürüm o sırada hâlâ
# koşuyor ve Next modülleri tembel yüklüyor; dizin ortadan kalkınca ilk
# `require` çöküyor. Canlı logda görülen tam olarak buydu:
#
#   ⨯ [Error: Cannot find module 'next/dist/compiled/cookie'
#     ... next/dist/cli/next-start.js] { code: 'MODULE_NOT_FOUND' }
#
# `Restart=always` olduğu için süreç hemen yeniden başlıyor, node_modules
# hâlâ yarım olduğu için yine çöküyor: site kurulum boyunca — bu makinede 16
# dakika — çökme döngüsünde kalıyor. Yeni ağaç ayrı bir dizinde kurulunca
# eski sürüm sağlam node_modules ile çalışmaya devam ediyor; kesinti yalnızca
# sondaki yeniden başlatma kadar oluyor.
bagimliliklari_kur() {
  rm -rf "$HAZIRLIK"
  mkdir -p "$HAZIRLIK"
  # npm ci'nin ihtiyacı olan iki dosya, bir de prisma/: @prisma/client'ın
  # postinstall'ı şemayı arıyor, bulamazsa buradaki kurulum canlıdakinden
  # farklı davranırdı. Aynı dosya sistemi, çünkü sondaki taşıma ancak aynı
  # bölümde anlık ad değiştirme olur.
  cp package.json package-lock.json "$HAZIRLIK/"
  cp -r prisma "$HAZIRLIK/"
  (cd "$HAZIRLIK" && npm ci --no-audit --no-fund)

  # Takas iki adımda: eski ağaç kenara alınır, yenisi yerine geçer. Arada
  # yolun boş kaldığı pencere milisaniye — yerini aldığı şey 16 dakikaydı.
  # Koşan sürecin ZATEN AÇIK dosyaları Linux'ta inode üzerinden yaşadığı için
  # eskisini silmek onu etkilemiyor.
  rm -rf node_modules.eski
  if [ -d node_modules ]; then mv node_modules node_modules.eski; fi
  mv "$HAZIRLIK/node_modules" node_modules
  rm -rf node_modules.eski "$HAZIRLIK"
}

# `npm ci` 500 paketi baştan kuruyor: bu makinede 16 dakika. Çoğu dağıtımda
# kilit dosyası hiç değişmiyor, yani o 16 dakika tamamen boşa gidiyordu.
# Yalnızca kilit değiştiğinde ya da node_modules eksikken kuruluyor.
if [ "$KILIT_ONCE" != "$KILIT_SONRA" ] || [ ! -d node_modules ]; then
  echo "bağımlılıklar kuruluyor (kilit değişti ya da node_modules yok)…"
  bagimliliklari_kur
else
  echo "bağımlılıklar değişmedi, kurulum atlandı"
fi

npx prisma migrate deploy
npm run build
echo "derleme tamam"

# --- servis kullanıcısı ---------------------------------------------------
# Servisler root olarak koşuyordu: systemd birimlerinde `User=` yoktu ve
# sistem servisi varsayılan olarak root çalışır. Uygulamada uzaktan kod
# çalıştırmaya yol açan bir açık, doğrudan makinenin tamamı demek olurdu.
#
# Kullanıcı sistem hesabı (giriş yok, ev dizini yok). Uygulama dizininin ve
# log dosyalarının sahipliği de ona geçiyor; `.env` yalnızca ona okunur
# kalıyor (600) çünkü içinde veritabanı parolası ve VAPID özel anahtarı var.
id -u rezzerv >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin rezzerv
chown -R rezzerv:rezzerv "$UYGULAMA"
chown rezzerv:rezzerv "$UYGULAMA/.env"
chmod 600 "$UYGULAMA/.env"
for L in /var/log/rezzerv-web.log /var/log/rezzerv-worker.log; do
  touch "$L"
  chown rezzerv:rezzerv "$L"
done

# Servis tanımları her dağıtımda yeniden yazılıyor: depo ile sunucu
# ayrışmasın. Değişiklik yoksa systemd zaten yeniden yüklemeyi ucuza kapatır.
cat > /etc/systemd/system/rezzerv-web.service <<'UNIT'
[Unit]
Description=Rezzerv web
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=rezzerv
Group=rezzerv
WorkingDirectory=/opt/rezzerv
EnvironmentFile=/opt/rezzerv/.env
# npm ÜZERİNDEN DEĞİL, doğrudan. systemd SIGTERM'i ExecStart sürecine
# gönderiyor; arada npm olduğunda sinyal `next start` çocuğuna güvenilir
# şekilde iletilmiyor ve systemd 90 saniyelik zaman aşımını bekleyip SIGKILL
# atıyordu. Her dağıtımda gereksiz kesinti demekti.
ExecStart=/opt/rezzerv/node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5
# Kapanma bütçesi sınırlı: takılan bir süreç dağıtımı 90 saniye bekletmesin.
TimeoutStopSec=20
StandardOutput=append:/var/log/rezzerv-web.log
StandardError=append:/var/log/rezzerv-web.log

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/rezzerv-worker.service <<'UNIT'
[Unit]
Description=Rezzerv arka plan isleri
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=rezzerv
Group=rezzerv
WorkingDirectory=/opt/rezzerv
EnvironmentFile=/opt/rezzerv/.env
# `server-only` düz Node'da hata fırlattığı için --conditions=react-server şart.
ExecStart=/usr/bin/node --conditions=react-server --import tsx src/worker/run.ts
Restart=always
RestartSec=10
# Worker'ın kendi zarif kapanışı 25 sn; systemd ondan sonra müdahale etsin.
TimeoutStopSec=35
StandardOutput=append:/var/log/rezzerv-worker.log
StandardError=append:/var/log/rezzerv-worker.log

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload

# Derleme BAŞARILI olduktan sonra yeniden başlatılıyor: derleme düşerse eski
# sürüm ayakta kalır ve kesinti yaşanmaz.
BASLANGIC=$(date +%s)
systemctl restart rezzerv-web rezzerv-worker

KOD=000
for _ in $(seq 1 60); do
  KOD=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ 2>/dev/null || echo 000)
  [ "$KOD" = "200" ] && break
  sleep 1
done
echo "kesinti: $(( $(date +%s) - BASLANGIC )) sn · web yanıtı: HTTP ${KOD}"
echo "servisler: web=$(systemctl is-active rezzerv-web) worker=$(systemctl is-active rezzerv-worker)"

if [ "$KOD" != "200" ]; then
  echo "!!! UYGULAMA AYAĞA KALKMADI — son log:"
  tail -20 /var/log/rezzerv-web.log
  exit 1
fi
# Betiğin kendisi de depodan tazelensin: /root/guncelle.sh elle kopyalanmıştı
# ve depo sürümü değiştiğinde sessizce geride kalıyordu — servis tanımlarını
# her dağıtımda yeniden yazma sebebimizin aynısı.
#
# `cp` DEĞİL, `mv`. Bash betiği çalışırken parça parça okuyor ve okuma
# konumunu dosya içinde tutuyor. `cp` aynı inode'u kesip üzerine yazdığı için
# koşan betik kalan baytları YENİ dosyadan okur; yeni sürüm daha uzunsa
# okuma konumu satır ortasına düşer. Canlıda tam olarak bu oldu:
#
#   /root/guncelle.sh: line 222: syntax error near unexpected token `('
#
# `mv` ise dizin girdisini değiştiriyor, eski inode koşan süreç için olduğu
# gibi kalıyor. Bu çalıştırma eski betikle bitiyor, yeni sürüm bir sonrakinde
# devreye giriyor. Sözdizimi önce denetleniyor: bozuk bir betik yerine
# geçerse sonraki dağıtım hiç açılmaz.
YENI_BETIK="$UYGULAMA/deploy/guncelle.sh"
if ! cmp -s "$YENI_BETIK" /root/guncelle.sh; then
  if bash -n "$YENI_BETIK"; then
    cp "$YENI_BETIK" /root/guncelle.sh.yeni
    chmod +x /root/guncelle.sh.yeni
    mv /root/guncelle.sh.yeni /root/guncelle.sh
    echo "dağıtım betiği depodan tazelendi (bir sonraki çalıştırmada geçerli)"
  else
    echo "!!! depodaki dağıtım betiği sözdizimi hatalı; tazeleme atlandı"
  fi
fi

echo "=== GÜNCELLEME BİTTİ ($ONCEKI → $YENI) ==="
