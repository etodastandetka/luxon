#!/bin/bash
# ФИНАЛЬНЫЙ скрипт - принудительно сбрасывает все и исправляет ВСЕ пути

set -e

echo "🔧 ФИНАЛЬНОЕ исправление ВСЕХ путей..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. ПРИНУДИТЕЛЬНО сбрасываем ВСЕ локальные изменения
echo "📥 ПРИНУДИТЕЛЬНО сбрасываю ВСЕ локальные изменения..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "✅ Все локальные изменения сброшены"
echo ""

# 2. Восстанавливаем ВСЕ файлы из lib/
echo "📥 Восстанавливаю ВСЕ файлы из lib/..."
mkdir -p lib
git checkout origin/main -- lib/ 2>/dev/null || git checkout main -- lib/ 2>/dev/null || true
echo "✅ Файлы lib/ восстановлены"
echo ""

# 3. ЗАМЕНЯЕМ ВСЕ варианты путей на @/lib/
echo "📝 Заменяю ВСЕ варианты путей на @/lib/..."

# СНАЧАЛА заменяем все a/lib/ на @/lib/ (ВСЕ возможные варианты)
echo "  • Заменяю a/lib/ на @/lib/..."
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'@/lib/|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"@/lib/|g' {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from 'a/lib/|from '@/lib/|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "a/lib/|from "@/lib/|g' {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|import.*'a/lib/|import.*'@/lib/|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|import.*"a/lib/|import.*"@/lib/|g' {} \;
sed -i "s|'a/lib/|'@/lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|"a/lib/|"@/lib/|g' middleware.ts 2>/dev/null || true
sed -i "s|from 'a/lib/|from '@/lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|from "a/lib/|from "@/lib/|g' middleware.ts 2>/dev/null || true

# Затем заменяем относительные пути на @/lib/
echo "  • Заменяю относительные пути на @/lib/..."

# app/dashboard - 3 уровня вверх
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '../../../lib/|from '@/lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "../../../lib/|from "@/lib/|g' {} \;

# app/api - 4 уровня вверх (ВСЕ файлы, включая geolocation)
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|from '../../../../lib/|from '@/lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i 's|from "../../../../lib/|from "@/lib/|g' {} \;

# app/api/auth/2fa - 6 уровней вверх
find app/api/auth/2fa -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '../../../../../lib/|from '@/lib/|g" {} \;
find app/api/auth/2fa -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "../../../../../lib/|from "@/lib/|g' {} \;

# middleware - ./lib/
sed -i "s|from './lib/|from '@/lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|from "./lib/|from "@/lib/|g' middleware.ts 2>/dev/null || true

echo "✅ Все пути заменены на @/lib/"
echo ""

# 4. Проверяем проблемные файлы
echo "🔍 Проверяю проблемные файлы:"
echo ""
echo "app/api/geolocation/verify/route.ts:"
grep -E "from ['\"].*lib/" app/api/geolocation/verify/route.ts | head -5 || echo "  (не найдено)"
echo ""
echo "app/api/geolocation/settings/route.ts:"
grep -E "from ['\"].*lib/" app/api/geolocation/settings/route.ts | head -5 || echo "  (не найдено)"
echo ""
echo "app/dashboard/page.tsx:"
grep -E "from ['\"].*lib/" app/dashboard/page.tsx | head -3 || echo "  (не найдено)"
echo ""

# 5. Ищем оставшиеся a/lib/
echo "🔍 Ищу оставшиеся a/lib/:"
remaining=$(grep -r "a/lib/" app/ middleware.ts 2>/dev/null | wc -l || echo "0")
if [ "$remaining" -gt 0 ]; then
    echo "  ⚠️  Найдено $remaining вхождений a/lib/!"
    grep -r "a/lib/" app/ middleware.ts 2>/dev/null | head -10
    echo ""
    echo "  🔧 Принудительно заменяю..."
    grep -rl "a/lib/" app/ middleware.ts 2>/dev/null | xargs sed -i "s|a/lib/|@/lib/|g" 2>/dev/null || true
    echo "  ✅ Заменено"
else
    echo "  ✅ a/lib/ не найдено"
fi
echo ""

# 6. Очищаем кеш
echo "🧹 Очищаю кеш..."
rm -rf .next node_modules/.cache tsconfig.tsbuildinfo .swc
echo "✅ Кеш очищен"
echo ""

# 7. Запускаем сборку
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
    echo ""
    echo "🔍 Финальная диагностика:"
    echo "Проверяю файлы geolocation:"
    echo ""
    echo "app/api/geolocation/verify/route.ts:"
    head -15 app/api/geolocation/verify/route.ts | grep -E "(import|from)"
    echo ""
    echo "app/api/geolocation/settings/route.ts:"
    head -15 app/api/geolocation/settings/route.ts | grep -E "(import|from)"
    echo ""
    echo "Ищу все a/lib/ в проекте:"
    grep -r "a/lib/" app/ middleware.ts 2>/dev/null | head -10 || echo "  (не найдено)"
    exit 1
fi

