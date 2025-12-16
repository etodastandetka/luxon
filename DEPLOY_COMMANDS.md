# 🚀 Команды для деплоя на сервер

## Подготовка

### 1. Обновление базы данных (2FA)

```bash
cd admin_nextjs
npm run db:push
npm run db:generate
```

### 2. Установка зависимостей для 2FA скрипта

```bash
cd admin_nextjs
pip install -r scripts/requirements-2fa.txt
```

Или вручную:
```bash
pip install psycopg2-binary qrcode[pil] pyotp
```

## Сборка проектов

### Админка (admin_nextjs)

```bash
cd admin_nextjs
npm install
npm run build
```

### Клиентский сайт (bot2/mini_app_site)

```bash
cd bot2/mini_app_site
npm install
npm run build
```

## Проверка перед деплоем

### 1. Проверка переменных окружения

**admin_nextjs/.env:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/luxon_admin
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=production
```

**bot2/mini_app_site/.env:**
```env
NODE_ENV=production
ADMIN_API_URL=http://127.0.0.1:3001
```

### 2. Проверка Nginx конфигураций

Убедитесь, что используются конфигурации с защитой:
- `nginx-configs/japar.click.cloudflare.conf` (для админки)
- `nginx-configs/luxon.dad.cloudflare.conf` (для клиентского сайта)

### 3. Проверка работы API

```bash
# Проверка админки
curl -I https://japar.click/api/public/payment-settings

# Проверка клиентского сайта
curl -I https://luxon.dad
```

## Команды для сервера

### 1. Остановка старых процессов

```bash
# Остановить PM2 процессы
pm2 stop all
# или
pm2 delete all
```

### 2. Обновление кода

```bash
cd /path/to/LUXON
git pull origin main
```

### 3. Обновление зависимостей

```bash
# Админка
cd admin_nextjs
npm install --production
npm run db:push
npm run db:generate

# Клиентский сайт
cd ../bot2/mini_app_site
npm install --production
```

### 4. Сборка проектов

```bash
# Админка
cd admin_nextjs
npm run build

# Клиентский сайт
cd ../bot2/mini_app_site
npm run build
```

### 5. Перезапуск через PM2

```bash
# Запуск админки
cd admin_nextjs
pm2 start ecosystem.config.js --env production

# Запуск клиентского сайта
cd ../bot2/mini_app_site
pm2 start ecosystem.config.js --env production

# Сохранить конфигурацию PM2
pm2 save
```

### 6. Обновление Nginx

```bash
# Копировать конфигурации с защитой
sudo cp nginx-configs/japar.click.cloudflare.conf /etc/nginx/sites-available/japar.click
sudo cp nginx-configs/luxon.dad.cloudflare.conf /etc/nginx/sites-available/luxon.dad

# Проверить конфигурацию
sudo nginx -t

# Перезагрузить Nginx
sudo systemctl reload nginx
```

### 7. Проверка работы

```bash
# Проверка процессов PM2
pm2 status
pm2 logs

# Проверка Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Проверка портов
netstat -tlnp | grep -E '3001|3030'
```

## Настройка 2FA для администратора

```bash
cd admin_nextjs
export DATABASE_URL='postgresql://user:password@localhost:5432/luxon_admin'
python scripts/generate-2fa-qr.py admin --save
```

Отсканируйте QR код приложением-аутентификатором и сохраните резервные коды.

## Проверка защиты

### Проверка rate limiting

```bash
# Должен вернуть 429 после 30 запросов
for i in {1..35}; do curl -I https://japar.click/api/payment; done
```

### Проверка блокировки подозрительных User-Agent

```bash
# Должен вернуть 403
curl -H "User-Agent: curl/7.68.0" https://japar.click/api/payment
```

### Проверка Cloudflare

```bash
# Должен показать Cloudflare заголовки
curl -I https://japar.click | grep -i "cf-"
```

## Мониторинг

### Логи PM2

```bash
pm2 logs admin_nextjs
pm2 logs mini_app_site
```

### Логи Nginx

```bash
sudo tail -f /var/log/nginx/japar.click.access.log
sudo tail -f /var/log/nginx/luxon.dad.access.log
```

### Мониторинг блокировок

Проверяйте логи на подозрительную активность:
```bash
# В логах Next.js будут записи о блокировках
pm2 logs | grep "🚫"
```

## Откат (если что-то пошло не так)

```bash
# Откатить код
cd /path/to/LUXON
git checkout HEAD~1

# Пересобрать
cd admin_nextjs && npm run build
cd ../bot2/mini_app_site && npm run build

# Перезапустить
pm2 restart all
```

## Важные замечания

1. ✅ **Всегда делайте бэкап БД** перед обновлением
2. ✅ **Проверяйте переменные окружения** перед деплоем
3. ✅ **Тестируйте на staging** перед продакшеном
4. ✅ **Мониторьте логи** после деплоя
5. ✅ **Проверяйте работу API** между клиентским сайтом и админкой

## Проверка совместимости API

После деплоя проверьте, что клиентский сайт может обращаться к админке:

```bash
# Из клиентского сайта к админке (внутренний запрос)
curl http://127.0.0.1:3001/api/public/payment-settings

# Внешний запрос через Cloudflare
curl https://japar.click/api/public/payment-settings
```

Оба должны работать корректно.

