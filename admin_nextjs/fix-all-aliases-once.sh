#!/bin/bash
# ФИНАЛЬНЫЙ скрипт - исправляет ВСЕ алиасы раз и навсегда

set -e

echo "🔧 ФИНАЛЬНОЕ исправление всех алиасов..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Обновляем файлы из git
echo "📥 Обновляю файлы из git..."
git pull origin main
echo ""

# 2. Исправляем конкретные проблемные файлы из ошибок
echo "📝 Исправляю конкретные файлы из ошибок сборки..."

# app/dashboard/crypto/page.tsx
if [ -f "app/dashboard/crypto/page.tsx" ]; then
    echo "  ✅ app/dashboard/crypto/page.tsx"
    sed -i "s|from ['\"]a/components/Layout|from '../../../components/Layout|g" app/dashboard/crypto/page.tsx
    sed -i "s|from ['\"]a/lib/crypto-pay|from '../../../lib/crypto-pay|g" app/dashboard/crypto/page.tsx
    sed -i "s|from ['\"]@/components/Layout|from '../../../components/Layout|g" app/dashboard/crypto/page.tsx
    sed -i "s|from ['\"]@/lib/crypto-pay|from '../../../lib/crypto-pay|g" app/dashboard/crypto/page.tsx
fi

# app/dashboard/page.tsx
if [ -f "app/dashboard/page.tsx" ]; then
    echo "  ✅ app/dashboard/page.tsx"
    sed -i "s|from ['\"]a/lib/sounds|from '../../lib/sounds|g" app/dashboard/page.tsx
    sed -i "s|from ['\"]a/lib/notifications|from '../../lib/notifications|g" app/dashboard/page.tsx
    sed -i "s|from ['\"]@/lib/sounds|from '../../lib/sounds|g" app/dashboard/page.tsx
    sed -i "s|from ['\"]@/lib/notifications|from '../../lib/notifications|g" app/dashboard/page.tsx
fi

# app/api/auth/login/route.ts
if [ -f "app/api/auth/login/route.ts" ]; then
    echo "  ✅ app/api/auth/login/route.ts"
    sed -i "s|from ['\"]a/lib/auth|from '../../../../lib/auth|g" app/api/auth/login/route.ts
    sed -i "s|from ['\"]@/lib/auth|from '../../../../lib/auth|g" app/api/auth/login/route.ts
fi

# 3. Исправляем ВСЕ остальные файлы
echo "📝 Исправляю все остальные файлы..."

# app/api - нужен путь ../../../../lib/
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]a/lib/|from '../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/lib/|from '../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]a/components/|from '../../../../components/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/components/|from '../../../../components/|g" {} \;

# app/dashboard - нужен путь ../../../lib/
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]a/lib/|from '../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/lib/|from '../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]a/components/|from '../../../components/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/components/|from '../../../components/|g" {} \;

# app/ (корневые) - нужен путь ../../lib/
find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]a/lib/|from '../../lib/|g" {} \;
find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/lib/|from '../../lib/|g" {} \;

# middleware.ts - нужен путь ./lib/
sed -i "s|from ['\"]a/lib/|from './lib/|g" middleware.ts 2>/dev/null || true
sed -i "s|from ['\"]@/lib/|from './lib/|g" middleware.ts 2>/dev/null || true

# 4. Исправляем ошибки с lg
echo "🧹 Исправляю ошибки lib/lg..."
find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|lib/lg/|lib/|g' {} \; 2>/dev/null || true
find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|components/lg/|components/|g' {} \; 2>/dev/null || true

echo ""
echo "✅ Исправление завершено!"
echo ""
echo "🔍 Проверяю результат..."
count=$(grep -r "from ['\"]a/\|from ['\"]@/" app/ lib/ middleware.ts 2>/dev/null | wc -l || echo "0")

if [ "$count" -eq 0 ]; then
    echo "✅ Все алиасы успешно заменены!"
    echo ""
    echo "🧹 Очищаю кеш..."
    rm -rf .next node_modules/.cache tsconfig.tsbuildinfo .swc
    echo ""
    echo "📦 Запускаю сборку..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Сборка успешна!"
        pm2 restart luxon-admin
    else
        echo ""
        echo "❌ Ошибка сборки!"
        exit 1
    fi
else
    echo "⚠️  Осталось алиасов: $count"
    grep -r "from ['\"]a/\|from ['\"]@/" app/ lib/ middleware.ts 2>/dev/null | head -10
fi

