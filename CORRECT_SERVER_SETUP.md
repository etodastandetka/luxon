# Настройка правильного сервера 147.45.99.111

## Подключение к правильному серверу:

```bash
ssh root@147.45.99.111
```

Пароль: `madSvQb*v*2rPU`

---

## Шаг 1: Проверка что вы на правильном сервере

```bash
hostname -I
# Должен показать: 147.45.99.111
```

---

## Шаг 2: Создание папок

```bash
mkdir -p /var/www
mkdir -p /var/log/nginx
mkdir -p /var/log/pm2
```

---

## Шаг 3: Клонирование репозитория

```bash
cd /var/www
git clone https://github.com/etodastandetka/ls.git luxon
cd /var/www/luxon
```

---

## Шаг 4: Установка пакетов

```bash
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git nginx certbot python3-certbot-nginx nodejs npm python3 python3-pip python3-venv pm2 build-essential postgresql-client
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

---

## Шаг 5: Выполнение скрипта настройки

```bash
cd /var/www/luxon
chmod +x setup_server_on_remote.sh
bash setup_server_on_remote.sh
```

---

## Если скрипта нет, создайте его:

```bash
cd /var/www/luxon
cat > setup.sh << 'EOF'
#!/bin/bash
set -e
BASE_DIR="/var/www/luxon"

echo "🚀 Начинаем настройку..."
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git nginx certbot python3-certbot-nginx nodejs npm python3 python3-pip python3-venv pm2 build-essential postgresql-client
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

mkdir -p /var/log/nginx /var/log/pm2 $BASE_DIR/tmp/receipt_uploads

# Nginx конфиги
cat > /etc/nginx/sites-available/lux-on.org << 'NGINX_EOF'
server {
    listen 80;
    server_name lux-on.org www.lux-on.org;
    access_log /var/log/nginx/lux-on.org.access.log;
    error_log /var/log/nginx/lux-on.org.error.log;
    client_max_body_size 50M;
    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX_EOF

cat > /etc/nginx/sites-available/pipiska.net << 'NGINX_EOF'
server {
    listen 80;
    server_name pipiska.net www.pipiska.net;
    access_log /var/log/nginx/pipiska.net.access.log;
    error_log /var/log/nginx/pipiska.net.error.log;
    client_max_body_size 50M;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/lux-on.org /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/pipiska.net /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
systemctl enable nginx

cd $BASE_DIR/app && npm install && npm run build
cd $BASE_DIR/admin_nextjs && npm install && npm run build
cd $BASE_DIR/bot && python3 -m venv venv && source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt

pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

cd $BASE_DIR/app && pm2 start ecosystem.config.js
cd $BASE_DIR/admin_nextjs && pm2 start ecosystem.config.js
cd $BASE_DIR/bot && pm2 start ecosystem.config.js

pm2 save
pm2 startup
pm2 status

echo "✅ Готово!"
EOF

chmod +x setup.sh
bash setup.sh
```

---

## Проверка:

```bash
# Проверка IP
hostname -I

# Проверка что репозиторий клонирован
ls -la /var/www/luxon

# Должны быть папки: app, admin_nextjs, bot
```

