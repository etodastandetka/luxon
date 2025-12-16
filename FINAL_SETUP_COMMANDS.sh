#!/bin/bash
# Готовые команды для финальной настройки
# Просто скопируйте и выполните на сервере

echo "🚀 Настройка Nginx..."

# Копирование конфигураций Nginx
sudo cp /var/www/luxon/nginx-configs/japar.click.conf /etc/nginx/sites-available/japar.click
sudo cp /var/www/luxon/nginx-configs/luxon.dad.conf /etc/nginx/sites-available/luxon.dad

# Активация конфигураций
sudo ln -sf /etc/nginx/sites-available/japar.click /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/luxon.dad /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx

echo "✅ Nginx настроен!"
echo ""
echo "📦 Установка зависимостей и сборка админки..."

# Админка
cd /var/www/luxon/admin_nextjs
npm install
npm run build

echo "✅ Админка собрана!"
echo ""
echo "📦 Установка зависимостей и сборка клиентского сайта..."

# Клиентский сайт
cd /var/www/luxon/bot2/mini_app_site
npm install
npm run build

echo "✅ Клиентский сайт собран!"
echo ""
echo "🚀 Запуск через PM2..."

# Запуск админки
cd /var/www/luxon/admin_nextjs
pm2 start ecosystem.config.js

# Запуск клиентского сайта
cd /var/www/luxon/bot2/mini_app_site
pm2 start ecosystem.config.js

# Сохранение PM2
pm2 save

echo ""
echo "✅ ВСЕ ГОТОВО!"
echo ""
echo "📊 Статус процессов:"
pm2 status
echo ""
echo "🌐 Сайты доступны:"
echo "  - Админка: https://japar.click"
echo "  - Клиентский сайт: https://luxon.dad"
echo ""
echo "📝 Полезные команды:"
echo "  pm2 logs              - Просмотр логов"
echo "  pm2 restart all       - Перезапуск всех процессов"
echo "  pm2 monit             - Мониторинг"

