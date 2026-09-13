#!/bin/bash
#
# Rezzerv — canlı sürümü güncelle.
#
# `sunucu-kur.sh` ilk kurulum içindir; bu betik yalnızca yeni sürümü alır.
# .env'e DOKUNMAZ: AUTH_SECRET ve veritabanı parolası orada duruyor, yeniden
# üretilirse bütün oturumlar düşer ve uygulama veritabanına bağlanamaz.
set -euo pipefail
exec > >(tee -a /root/rezzerv-dagitim.log) 2>&1
echo "=== $(date) güncelleme ==="

UYGULAMA=/opt/rezzerv
cd "$UYGULAMA"

ONCEKI=$(git rev-parse --short HEAD)
git fetch --quiet origin
git reset --hard origin/main --quiet
YENI=$(git rev-parse --short HEAD)
echo "sürüm: $ONCEKI → $YENI"

npm ci --no-audit --no-fund
npx prisma migrate deploy
npm run build

# Derleme bittikten SONRA yeniden başlatılıyor: derleme başarısız olursa eski
# sürüm ayakta kalır ve kesinti yaşanmaz.
systemctl restart rezzerv-web rezzerv-worker
sleep 4

for i in $(seq 1 20); do
  KOD=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ || echo 000)
  [ "$KOD" = "200" ] && break
  sleep 2
done
echo "web yanıtı: HTTP ${KOD}"
echo "servisler: web=$(systemctl is-active rezzerv-web) worker=$(systemctl is-active rezzerv-worker)"

if [ "$KOD" != "200" ]; then
  echo "!!! UYGULAMA AYAĞA KALKMADI — son log:"
  tail -20 /var/log/rezzerv-web.log
  exit 1
fi
echo "=== GÜNCELLEME BİTTİ ==="
