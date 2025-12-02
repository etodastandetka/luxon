#!/bin/bash
# Исправление с использованием абсолютных путей через @/lib/

set -e

echo "🔧 Исправление путей на абсолютные (@/lib/)..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Обновляем из git
echo "📥 Обновляю из git..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "✅ Обновлено"
echo ""

# 2. Заменяем относительные пути на абсолютные через @/lib/
echo "📝 Заменяю относительные пути на @/lib/..."

# app/dashboard - 3 уровня вверх -> @/lib/
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '../../../lib/|from '@/lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "../../../lib/|from "@/lib/|g' {} \;

# app/api - 4 уровня вверх -> @/lib/
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" ! -path "*/crypto-pay/*" ! -path "*/requests/\[*\]/*" ! -path "*/limits/*" ! -path "*/users/\[*\]/*" -exec sed -i "s|from '../../../../lib/|from '@/lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" ! -path "*/crypto-pay/*" ! -path "*/requests/\[*\]/*" ! -path "*/limits/*" ! -path "*/users/\[*\]/*" -exec sed -i 's|from "../../../../lib/|from "@/lib/|g' {} \;

# app/api/auth/2fa - 6 уровней вверх -> @/lib/
find app/api/auth/2fa -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '../../../../../lib/|from '@/lib/|g" {} \;
find app/api/auth/2fa -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "../../../../../lib/|from "@/lib/|g' {} \;

# middleware - ./lib/ -> @/lib/
sed -i "s|from './lib/|from '@/lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|from "./lib/|from "@/lib/|g' middleware.ts 2>/dev/null || true

echo "✅ Пути заменены на @/lib/"
echo ""

# 3. Показываем примеры
echo "📝 Примеры импортов после исправления:"
echo "app/dashboard/page.tsx:"
grep -E "from ['\"].*lib/" app/dashboard/page.tsx | head -2 || echo "  (не найдено)"
echo ""
echo "app/api/deposit-balance/route.ts:"
grep -E "from ['\"].*lib/" app/api/deposit-balance/route.ts | head -3 || echo "  (не найдено)"
echo ""

# 4. Очищаем кеш
echo "🧹 Очищаю кеш..."
rm -rf .next node_modules/.cache tsconfig.tsbuildinfo .swc
echo "✅ Кеш очищен"
echo ""

# 5. Запускаем сборку
echo "📦 Запускаю сборку..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Сборка успешна!"
    pm2 restart luxon-admin
    echo ""
    echo "🎉 Всё готово!"
else
    echo ""
    echo "❌ Ошибка сборки!"
    exit 1
fi

