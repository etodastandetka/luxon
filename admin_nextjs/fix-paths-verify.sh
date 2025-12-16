#!/bin/bash
# Скрипт для исправления путей с проверкой файлов

set -e

echo "🔧 Исправление путей на сервере с проверкой..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Принудительно сбрасываем ВСЕ локальные изменения
echo "📥 Сбрасываю все локальные изменения..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "✅ Локальные изменения сброшены"
echo ""

# 2. Проверяем существование lib/
echo "📁 Проверяю lib/..."
if [ ! -d "lib" ]; then
    echo "❌ Папка lib/ не существует! Создаю..."
    mkdir -p lib
fi

# 3. Восстанавливаем ВСЕ файлы из lib/
echo "📥 Восстанавливаю ВСЕ файлы из lib/..."
git checkout origin/main -- lib/ 2>/dev/null || git checkout main -- lib/ 2>/dev/null || true

# Проверяем, что файлы действительно существуют
required_files=(
    "lib/sounds.ts"
    "lib/notifications.ts"
    "lib/api-helpers.ts"
    "lib/prisma.ts"
    "lib/deposit-balance.ts"
    "lib/security.ts"
    "lib/two-factor.ts"
)

echo "📄 Проверяю наличие файлов:"
all_exist=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - НЕ НАЙДЕН!"
        all_exist=false
    fi
done

if [ "$all_exist" = false ]; then
    echo ""
    echo "⚠️  Некоторые файлы отсутствуют! Пытаюсь восстановить из git..."
    git ls-files lib/ | while read file; do
        if [ ! -f "$file" ]; then
            echo "  Восстанавливаю $file..."
            git checkout origin/main -- "$file" 2>/dev/null || git checkout main -- "$file" 2>/dev/null || true
        fi
    done
fi
echo ""

# 4. Исправляем пути
echo "📝 Исправляю пути..."

# app/dashboard/page.tsx
if [ -f "app/dashboard/page.tsx" ]; then
    sed -i "s|from '../../lib/sounds'|from '../../../lib/sounds'|g" app/dashboard/page.tsx
    sed -i 's|from "../../lib/sounds"|from "../../../lib/sounds"|g' app/dashboard/page.tsx
    sed -i "s|from '../../lib/notifications'|from '../../../lib/notifications'|g" app/dashboard/page.tsx
    sed -i 's|from "../../lib/notifications"|from "../../../lib/notifications"|g' app/dashboard/page.tsx
    echo "  ✅ app/dashboard/page.tsx"
fi

# app/api/deposit-balance/route.ts
if [ -f "app/api/deposit-balance/route.ts" ]; then
    sed -i "s|from '../../../lib/|from '../../../../lib/|g" app/api/deposit-balance/route.ts
    sed -i 's|from "../../../lib/|from "../../../../lib/|g' app/api/deposit-balance/route.ts
    echo "  ✅ app/api/deposit-balance/route.ts"
fi

# Все остальные файлы
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '../../lib/|from '../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "../../lib/|from "../../../lib/|g' {} \;

find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" ! -path "*/crypto-pay/*" ! -path "*/requests/\[*\]/*" ! -path "*/limits/*" ! -path "*/users/\[*\]/*" -exec sed -i "s|from '../../../lib/|from '../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" ! -path "*/crypto-pay/*" ! -path "*/requests/\[*\]/*" ! -path "*/limits/*" ! -path "*/users/\[*\]/*" -exec sed -i 's|from "../../../lib/|from "../../../../lib/|g' {} \;

# Алиасы
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|'a/lib/|'../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i 's|"a/lib/|"../../../../lib/|g' {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|'@/lib/|'../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i 's|"@/lib/|"../../../../lib/|g' {} \;

find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"../../../lib/|g' {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'@/lib/|'../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"@/lib/|"../../../lib/|g' {} \;

sed -i "s|'a/lib/|'./lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|"a/lib/|"./lib/|g' middleware.ts 2>/dev/null || true
sed -i "s|'@/lib/|'./lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|"@/lib/|"./lib/|g' middleware.ts 2>/dev/null || true

echo "✅ Пути исправлены"
echo ""

# 5. Финальная проверка файлов
echo "🔍 Финальная проверка файлов:"
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        echo "  ✅ $file (размер: $size байт)"
    else
        echo "  ❌ $file - ВСЕ ЕЩЕ НЕ НАЙДЕН!"
    fi
done
echo ""

# 6. Показываем примеры импортов
echo "📝 Примеры импортов после исправления:"
echo ""
echo "app/dashboard/page.tsx:"
grep -E "from ['\"].*lib/(sounds|notifications)" app/dashboard/page.tsx | head -2 || echo "  (не найдено)"
echo ""
echo "app/api/deposit-balance/route.ts:"
grep -E "from ['\"].*lib/" app/api/deposit-balance/route.ts | head -3 || echo "  (не найдено)"
echo ""

# 7. Очищаем кеш
echo "🧹 Очищаю кеш..."
rm -rf .next node_modules/.cache tsconfig.tsbuildinfo .swc
echo "✅ Кеш очищен"
echo ""

# 8. Запускаем сборку
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
    echo "🔍 Дополнительная диагностика:"
    echo "Проверьте файлы:"
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            echo "  ❌ $file отсутствует"
        fi
    done
    exit 1
fi

