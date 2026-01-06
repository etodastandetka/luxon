#!/bin/bash
# Быстрая настройка Nginx и SSL сертификатов

set -e

echo "🔐 Настройка Nginx и SSL сертификатов"
echo ""

# Проверка конфигурации nginx
echo "1️⃣ Проверка конфигурации Nginx..."
nginx -t

# Перезапуск nginx
echo ""
echo "2️⃣ Перезапуск Nginx..."
systemctl restart nginx
systemctl enable nginx

# Проверка работы приложений
echo ""
echo "3️⃣ Проверка работы приложений..."
echo "Проверка клиентского сайта (порт 3030):"
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3030 || echo "❌ Не работает"
echo ""

echo "Проверка админки (порт 3001):"
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001 || echo "❌ Не работает"
echo ""

# Проверка DNS
echo "4️⃣ Проверка DNS..."
echo "lux-on.org:"
dig +short lux-on.org || echo "❌ DNS не настроен"
echo ""

echo "pipiska.net:"
dig +short pipiska.net || echo "❌ DNS не настроен"
echo ""

echo "⚠️  ВАЖНО: Перед получением SSL сертификатов настройте DNS!"
echo "   - lux-on.org → 147.45.99.111"
echo "   - pipiska.net → 147.45.99.111"
echo ""
echo "Подождите 5-10 минут после настройки DNS"
echo ""

read -p "DNS настроены? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "5️⃣ Получение SSL сертификатов..."
    
    # Сертификат для lux-on.org
    echo "Получение сертификата для lux-on.org..."
    certbot --nginx -d lux-on.org -d www.lux-on.org \
      --non-interactive \
      --agree-tos \
      --email admin@lux-on.org \
      --redirect || echo "❌ Ошибка получения сертификата для lux-on.org"
    
    echo ""
    echo "Получение сертификата для pipiska.net..."
    certbot --nginx -d pipiska.net -d www.pipiska.net \
      --non-interactive \
      --agree-tos \
      --email admin@pipiska.net \
      --redirect || echo "❌ Ошибка получения сертификата для pipiska.net"
    
    echo ""
    echo "✅ Готово!"
    echo ""
    echo "Проверьте сайты:"
    echo "  - https://lux-on.org"
    echo "  - https://pipiska.net"
else
    echo ""
    echo "Настройте DNS и затем выполните:"
    echo "  certbot --nginx -d lux-on.org -d www.lux-on.org --non-interactive --agree-tos --email admin@lux-on.org --redirect"
    echo "  certbot --nginx -d pipiska.net -d www.pipiska.net --non-interactive --agree-tos --email admin@pipiska.net --redirect"
fi

