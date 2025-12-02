#!/bin/bash
# Финальное исправление с полной очисткой и пересборкой

set -e

echo "🔧 ФИНАЛЬНОЕ исправление путей..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Принудительно сбрасываем ВСЕ локальные изменения
echo "📥 Сбрасываю все локальные изменения..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "✅ Локальные изменения сброшены"
echo ""

# 2. Восстанавливаем ВСЕ файлы из lib/
echo "📥 Восстанавливаю ВСЕ файлы из lib/..."
mkdir -p lib
git checkout origin/main -- lib/ 2>/dev/null || git checkout main -- lib/ 2>/dev/null || true

# Принудительно восстанавливаем каждый файл
required_files=(
    "lib/sounds.ts"
    "lib/notifications.ts"
    "lib/api-helpers.ts"
    "lib/prisma.ts"
    "lib/deposit-balance.ts"
    "lib/security.ts"
    "lib/two-factor.ts"
    "lib/auth.ts"
    "lib/crypto-pay.ts"
    "lib/telegram-group.ts"
    "lib/casino-withdraw.ts"
    "lib/auto-deposit.ts"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "  Восстанавливаю $file..."
        git checkout origin/main -- "$file" 2>/dev/null || git checkout main -- "$file" 2>/dev/null || true
    fi
done

echo "✅ Файлы lib/ восстановлены"
echo ""

# 3. Исправляем пути
echo "📝 Исправляю пути..."

# app/dashboard/page.tsx
if [ -f "app/dashboard/page.tsx" ]; then
    sed -i "s|from '../../lib/sounds'|from '../../../lib/sounds'|g" app/dashboard/page.tsx
    sed -i 's|from "../../lib/sounds"|from "../../../lib/sounds"|g' app/dashboard/page.tsx
    sed -i "s|from '../../lib/notifications'|from '../../../lib/notifications'|g" app/dashboard/page.tsx
    sed -i 's|from "../../lib/notifications"|from "../../../lib/notifications"|g' app/dashboard/page.tsx
fi

# app/api/deposit-balance/route.ts
if [ -f "app/api/deposit-balance/route.ts" ]; then
    sed -i "s|from '../../../lib/|from '../../../../lib/|g" app/api/deposit-balance/route.ts
    sed -i 's|from "../../../lib/|from "../../../../lib/|g' app/api/deposit-balance/route.ts
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

# 4. ПОЛНАЯ очистка всех кешей
echo "🧹 ПОЛНАЯ очистка всех кешей..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf tsconfig.tsbuildinfo
rm -rf .swc
rm -rf .turbo
find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "node_modules/.cache" -exec rm -rf {} + 2>/dev/null || true
echo "✅ Кеши очищены"
echo ""

# 5. Проверяем файлы перед сборкой
echo "🔍 Финальная проверка файлов:"
all_ok=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        if [ "$size" -gt 0 ]; then
            echo "  ✅ $file ($size байт)"
        else
            echo "  ⚠️  $file (пустой файл!)"
            all_ok=false
        fi
    else
        echo "  ❌ $file - НЕ НАЙДЕН!"
        all_ok=false
    fi
done

if [ "$all_ok" = false ]; then
    echo ""
    echo "❌ Некоторые файлы отсутствуют или пусты!"
    echo "Попытка восстановления из git..."
    git ls-files lib/ | while read file; do
        if [ ! -f "$file" ] || [ ! -s "$file" ]; then
            echo "  Восстанавливаю $file..."
            git checkout origin/main -- "$file" 2>/dev/null || git checkout main -- "$file" 2>/dev/null || true
        fi
    done
fi
echo ""

# 6. Запускаем сборку
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
        elif [ ! -s "$file" ]; then
            echo "  ⚠️  $file пуст"
        fi
    done
    echo ""
    echo "Проверьте пути в проблемных файлах:"
    echo "app/dashboard/page.tsx:"
    grep -E "from ['\"].*lib/(sounds|notifications)" app/dashboard/page.tsx | head -2 || echo "  (не найдено)"
    echo ""
    echo "app/api/deposit-balance/route.ts:"
    grep -E "from ['\"].*lib/" app/api/deposit-balance/route.ts | head -3 || echo "  (не найдено)"
    exit 1
fi

