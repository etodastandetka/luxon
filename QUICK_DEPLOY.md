# ⚡ Быстрый деплой на сервер

## Одной командой

```bash
bash SERVER_DEPLOY.sh
```

## Или пошагово

### 1. Обновление кода и БД

```bash
git pull origin main
cd admin_nextjs
npm run db:push
npm run db:generate
cd ..
```

### 2. Сборка проектов

```bash
# Админка
cd admin_nextjs
npm install --production
npm run build

# Клиентский сайт
cd ../bot2/mini_app_site
npm install --production
npm run build
cd ../..
```

### 3. Перезапуск PM2

```bash
pm2 restart all
# или
pm2 stop all
cd admin_nextjs && pm2 start ecosystem.config.js --env production
cd ../bot2/mini_app_site && pm2 start ecosystem.config.js --env production
pm2 save
```

### 4. Обновление Nginx

```bash
sudo cp nginx-configs/japar.click.cloudflare.conf /etc/nginx/sites-available/japar.click
sudo cp nginx-configs/luxon.dad.cloudflare.conf /etc/nginx/sites-available/luxon.dad
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Проверка

```bash
pm2 status
curl -I http://127.0.0.1:3001/api/public/payment-settings
curl -I http://127.0.0.1:3030
```

## Важно перед деплоем

1. ✅ Проверьте переменные окружения в `.env` файлах
2. ✅ Убедитесь, что база данных доступна
3. ✅ Проверьте, что порты 3001 и 3030 свободны
4. ✅ Убедитесь, что Nginx настроен правильно

## После деплоя

1. ✅ Проверьте работу сайтов: https://japar.click и https://luxon.dad
2. ✅ Проверьте логи: `pm2 logs`
3. ✅ Проверьте работу API между клиентским сайтом и админкой
4. ✅ Мониторьте логи на подозрительную активность

## Настройка 2FA (опционально)

```bash
cd admin_nextjs
export DATABASE_URL='postgresql://user:password@localhost:5432/luxon_admin'
pip install -r scripts/requirements-2fa.txt
python scripts/generate-2fa-qr.py admin --save
```

## Откат при проблемах

```bash
git checkout HEAD~1
cd admin_nextjs && npm run build
cd ../bot2/mini_app_site && npm run build
pm2 restart all
```
