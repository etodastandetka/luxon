#!/bin/bash
# Скрипт для диагностики проблемы с редиректом после 2FA

echo "🔍 Диагностика проблемы с редиректом после 2FA"
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

echo "📋 Проверяю логи PM2 на наличие проблем с 2FA..."
echo ""

# Ищем логи связанные с 2FA и dashboard
pm2 logs luxon-admin --lines 100 --nostream | grep -E "(2FA|dashboard|auth_token|token|redirect)" | tail -20

echo ""
echo "📋 Проверяю настройки cookie в коде..."
echo ""

# Проверяем настройки cookie в API
echo "API /api/auth/2fa/verify cookie settings:"
grep -A 5 "cookies.set('auth_token'" app/api/auth/2fa/verify/route.ts | head -6

echo ""
echo "📋 Проверяю middleware логику..."
echo ""

# Проверяем логику проверки токена в middleware
grep -A 10 "pathname.startsWith('/dashboard')" middleware.ts | head -15

echo ""
echo "💡 Рекомендации:"
echo "1. Проверьте логи PM2: pm2 logs luxon-admin --lines 50"
echo "2. Проверьте, не блокируется ли ваш IP: grep 'Blocked IP' в логах"
echo "3. Проверьте cookie в браузере (DevTools → Application → Cookies)"
echo "4. Убедитесь, что secure: true только для HTTPS"
echo ""

