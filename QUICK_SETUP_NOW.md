# ⚡ Быстрое развертывание БЕЗ Cloudflare

## Шаг 1: Добавьте DNS записи в Njalla (2 минуты)

### Для japar.click:
1. Нажмите "+ Add record"
2. Type: `A`, Name: `@`, Content: `67.217.228.192`, TTL: `3h`
3. Сохраните

### Для luxon.dad:
1. Нажмите "+ Add record"  
2. Type: `A`, Name: `@`, Content: `67.217.228.192`, TTL: `3h`
3. Сохраните

## Шаг 2: Подождите 5-10 минут

Проверяйте на сервере:
```bash
dig japar.click +short
dig luxon.dad +short
```

Когда вернется `67.217.228.192` - продолжайте.

## Шаг 3: Настройте Nginx (если еще не сделано)

```bash
# Копируем конфигурации
sudo cp /var/www/luxon/nginx-configs/japar.click.conf /etc/nginx/sites-available/japar.click
sudo cp /var/www/luxon/nginx-configs/luxon.dad.conf /etc/nginx/sites-available/luxon.dad

# Активируем
sudo ln -sf /etc/nginx/sites-available/japar.click /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/luxon.dad /etc/nginx/sites-enabled/

# Проверяем
sudo nginx -t

# Перезагружаем
sudo systemctl reload nginx
```

## Шаг 4: Получите SSL сертификаты

```bash
# Для админки
sudo certbot --nginx -d japar.click -d www.japar.click

# Для клиентского сайта
sudo certbot --nginx -d luxon.dad -d www.luxon.dad
```

## Шаг 5: Запустите приложения

```bash
cd /var/www/luxon

# Админка
cd admin_nextjs
npm install
npm run build
pm2 start ecosystem.config.js

# Клиентский сайт
cd ../bot2/mini_app_site
npm install
npm run build
pm2 start ecosystem.config.js

# Сохраните PM2
pm2 save
```

## Готово! ✅

- Админка: https://japar.click
- Клиентский сайт: https://luxon.dad

## Если что-то не работает:

```bash
# Проверьте логи
pm2 logs
sudo tail -f /var/log/nginx/error.log

# Проверьте статус
pm2 status
sudo systemctl status nginx
```

