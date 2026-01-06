# Команды для выполнения на сервере

Подключитесь к серверу:
```bash
ssh root@147.45.99.111
```
Пароль: `madSvQb*v*2rPU`

---

## Шаг 1: Создание папок и настройка прав

```bash
# Создание папки
mkdir -p /var/www/luxon

# Установка прав
chown -R root:root /var/www/luxon
chmod -R 755 /var/www

# Создание папок для логов
mkdir -p /var/log/nginx
mkdir -p /var/log/pm2
mkdir -p /var/www/luxon/tmp/receipt_uploads
```

---

## Шаг 2: Клонирование репозитория

```bash
cd /var/www
git clone https://github.com/etodastandetka/ls.git luxon
cd /var/www/luxon
```

---

## Шаг 3: Установка необходимых пакетов

```bash
# Обновление системы
apt-get update && apt-get upgrade -y

# Установка базовых пакетов
apt-get install -y curl wget git nginx certbot python3-certbot-nginx nodejs npm python3 python3-pip python3-venv pm2 build-essential postgresql-client

# Обновление Node.js до LTS версии
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Проверка версий
node -v
npm -v
python3 --version
```

---

## Шаг 4: Выполнение скрипта настройки

```bash
cd /var/www/luxon
chmod +x setup_server_on_remote.sh
bash setup_server_on_remote.sh
```

---

## Шаг 5: Настройка переменных окружения (после установки)

### 5.1. Клиентский сайт
```bash
nano /var/www/luxon/app/.env.local
```

Добавьте:
```env
NEXT_PUBLIC_ADMIN_API_URL=https://pipiska.net
NEXT_PUBLIC_CLIENT_URL=https://lux-on.org
```

### 5.2. Админка
```bash
nano /var/www/luxon/admin_nextjs/.env
```

Добавьте необходимые переменные из `admin_nextjs/ENV_CONFIG.md`

### 5.3. Бот
```bash
nano /var/www/luxon/bot/.env
```

Добавьте токены ботов и другие настройки.

---

## Шаг 6: Перезапуск сервисов

```bash
# Перезапуск PM2
cd /var/www/luxon/app
pm2 restart ecosystem.config.js

cd /var/www/luxon/admin_nextjs
pm2 restart ecosystem.config.js

cd /var/www/luxon/bot
pm2 restart ecosystem.config.js

pm2 save

# Перезапуск nginx
systemctl restart nginx
```

---

## Шаг 7: Настройка DNS

В панели управления DNS настройте A записи:
- `lux-on.org` → `147.45.99.111`
- `www.lux-on.org` → `147.45.99.111`
- `pipiska.net` → `147.45.99.111`
- `www.pipiska.net` → `147.45.99.111`

---

## Шаг 8: Получение SSL сертификатов (после настройки DNS)

Подождите 5-10 минут после настройки DNS, затем:

```bash
# Для lux-on.org
certbot --nginx -d lux-on.org -d www.lux-on.org --non-interactive --agree-tos --email admin@lux-on.org --redirect

# Для pipiska.net
certbot --nginx -d pipiska.net -d www.pipiska.net --non-interactive --agree-tos --email admin@pipiska.net --redirect
```

---

## Проверка работы

```bash
# Статус PM2
pm2 status

# Статус nginx
systemctl status nginx

# Логи
pm2 logs
tail -f /var/log/nginx/error.log
```

---

## Если что-то пошло не так

### Пересобрать проекты:
```bash
cd /var/www/luxon/app
rm -rf .next node_modules
npm install
npm run build
pm2 restart ecosystem.config.js

cd /var/www/luxon/admin_nextjs
rm -rf .next node_modules
npm install
npm run build
pm2 restart ecosystem.config.js
```

### Проверить конфигурацию nginx:
```bash
nginx -t
```

### Перезапустить все:
```bash
pm2 restart all
systemctl restart nginx
```

