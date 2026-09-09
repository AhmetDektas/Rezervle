#!/bin/bash
#
# Rezzerv — VPS kurulumu (Ubuntu 24.04).
#
# Betik TEKRAR ÇALIŞTIRILABİLİR: her adım "zaten varsa dokunma" mantığında.
# Yarıda kalan bir kurulumu baştan başlatmak yerine aynı komutu tekrar
# çalıştırmak yeterli.
#
# Node, Postgres ve Redis'in kurulu olduğu varsayılır (bkz. /root/kur.sh).
set -euo pipefail
exec > >(tee -a /root/rezzerv-dagitim.log) 2>&1
echo "=== $(date) dağıtım ==="

UYGULAMA=/opt/rezzerv
DEPO=https://github.com/AhmetDektas/Rezervle.git
ALAN=5.10.220.137.sslip.io
DB_PAROLA_DOSYA=/root/.rezzerv-db-parola

# --- 1) Takas alanı -------------------------------------------------------
# `next build` bellek isteyen bir iş; 8 GB'lık makinede başka servislerle
# birlikte OOM'a girebiliyor. Takası 4 GB'a çıkarmak derlemeyi güvene alıyor.
if [ "$(free -m | awk '/Swap:/ {print $2}')" -lt 3500 ]; then
  swapoff /swap.img 2>/dev/null || true
  fallocate -l 4G /swap.img
  chmod 600 /swap.img
  mkswap /swap.img >/dev/null
  swapon /swap.img
  grep -q '/swap.img' /etc/fstab || echo '/swap.img none swap sw 0 0' >> /etc/fstab
  echo "takas 4 GB'a çıkarıldı"
fi

# --- 2) Veritabanı --------------------------------------------------------
# Parola BİR KEZ üretilip diskte saklanıyor: betik tekrar çalıştığında aynı
# parola kullanılmalı, yoksa uygulama bağlanamaz hale gelir.
if [ ! -f "$DB_PAROLA_DOSYA" ]; then
  openssl rand -hex 24 > "$DB_PAROLA_DOSYA"
  chmod 600 "$DB_PAROLA_DOSYA"
fi
DB_PAROLA=$(cat "$DB_PAROLA_DOSYA")

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='rezzerv'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE rezzerv LOGIN PASSWORD '$DB_PAROLA';"
sudo -u postgres psql -c "ALTER ROLE rezzerv PASSWORD '$DB_PAROLA';" >/dev/null
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='rezzerv'" | grep -q 1 \
  || sudo -u postgres createdb -O rezzerv rezzerv
echo "veritabanı hazır"

# --- 3) Kod ---------------------------------------------------------------
if [ -d "$UYGULAMA/.git" ]; then
  git -C "$UYGULAMA" fetch --quiet origin
  git -C "$UYGULAMA" reset --hard origin/main --quiet
else
  git clone --quiet "$DEPO" "$UYGULAMA"
fi
cd "$UYGULAMA"
echo "kod: $(git rev-parse --short HEAD)"

# --- 4) Ortam değişkenleri ------------------------------------------------
# AUTH_SECRET de bir kez üretilip korunuyor: her dağıtımda değişseydi tüm
# oturumlar düşerdi.
if [ ! -f "$UYGULAMA/.env" ]; then
  cat > "$UYGULAMA/.env" <<ENV
DATABASE_URL="postgresql://rezzerv:${DB_PAROLA}@127.0.0.1:5432/rezzerv?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
AUTH_SECRET="$(openssl rand -base64 48)"
NEXT_PUBLIC_APP_URL="https://${ALAN}"
NODE_ENV="production"
# Sahte ödeme sağlayıcısıyla kapora tahsilatı AÇILAMAZ: açılış kontrolleri
# (src/instrumentation.ts) bu kombinasyonda uygulamayı başlatmayı reddediyor.
# Müşteriye "ödendi" deyip hiçbir para hareket etmemesi engelleniyor.
DEPOSITS_ENABLED="false"
WORKER_SHUTDOWN_TIMEOUT_MS="25000"
# Abonelik havalesi için; tanımsızken panel "ödeme bilgileri tanımlanmadı" der.
SUBSCRIPTION_IBAN=""
SUBSCRIPTION_TITLE=""
ENV
  chmod 600 "$UYGULAMA/.env"
  echo ".env üretildi"
else
  echo ".env korundu (mevcut anahtarlar değişmedi)"
fi

# --- 5) Bağımlılıklar ve derleme -----------------------------------------
# devDependencies GEREKLİ: worker tsx ile çalışıyor ve `next build` de
# geliştirme bağımlılıklarını kullanıyor.
npm ci --no-audit --no-fund
npx prisma migrate deploy
npm run build
echo "derleme tamam"

# --- 6) Servisler ---------------------------------------------------------
cat > /etc/systemd/system/rezzerv-web.service <<'UNIT'
[Unit]
Description=Rezzerv web
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
WorkingDirectory=/opt/rezzerv
EnvironmentFile=/opt/rezzerv/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
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
WorkingDirectory=/opt/rezzerv
EnvironmentFile=/opt/rezzerv/.env
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rezzerv-worker.log
StandardError=append:/var/log/rezzerv-worker.log

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now rezzerv-web rezzerv-worker
echo "servisler kuruldu"

# --- 7) nginx -------------------------------------------------------------
cat > /etc/nginx/sites-available/rezzerv <<NGINX
server {
    listen 80;
    listen [::]:80;
    # Çıplak IP de buraya düşüyor: ziyaretçi IP'yi yazsa bile uygulamaya
    # ulaşsın. certbot HTTPS'i kurunca kendisi yönlendirme ekleyecek.
    server_name ${ALAN} 5.10.220.137;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        # Üretimde oturum çerezi Secure işaretli; bu başlık olmadan Next
        # isteği http sanar ve çerez hiç geri gelmez.
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    access_log /var/log/nginx/rezzerv.access.log;
    error_log  /var/log/nginx/rezzerv.error.log;
}
NGINX

ln -sf /etc/nginx/sites-available/rezzerv /etc/nginx/sites-enabled/rezzerv
nginx -t && systemctl reload nginx
echo "nginx hazır"

echo "=== DAĞITIM BİTTİ ==="
