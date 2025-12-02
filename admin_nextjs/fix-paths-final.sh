#!/bin/bash
# ФИНАЛЬНЫЙ скрипт - исправляет пути начинающиеся с / и проверяет все файлы

set -e

echo "🔧 ФИНАЛЬНОЕ исправление путей и проверка файлов..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Принудительно обновляем ВСЁ из git
echo "📥 Принудительно обновляю ВСЁ из git..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "✅ Файлы обновлены"
echo ""

# 2. Проверяем наличие всех необходимых файлов в lib/
echo "🔍 Проверяю наличие файлов в lib/..."
required_files=(
    "lib/two-factor.ts"
    "lib/sounds.ts"
    "lib/notifications.ts"
    "lib/security.ts"
    "lib/auth.ts"
    "lib/api-helpers.ts"
    "lib/prisma.ts"
    "lib/crypto-pay.ts"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file существует"
    else
        echo "  ❌ $file НЕ НАЙДЕН!"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    echo ""
    echo "📥 Восстанавливаю отсутствующие файлы из git..."
    git checkout origin/main -- lib/ 2>/dev/null || git checkout main -- lib/ 2>/dev/null || true
    echo "✅ Файлы восстановлены"
    echo ""
fi

# 3. Исправляем пути, начинающиеся с /
echo "📝 Исправляю пути, начинающиеся с /..."
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '/components/|from '../../../components/|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "/components/|from "../../../components/|g' {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '/lib/|from '../../../../lib/|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "/lib/|from "../../../../lib/|g' {} \;

# 4. Исправляем все алиасы
echo "📝 Исправляю все алиасы..."
# app/api/auth/login/route.ts
sed -i "s|'a/lib/auth'|'../../../../lib/auth'|g" app/api/auth/login/route.ts 2>/dev/null || true
sed -i 's|"a/lib/auth"|"../../../../lib/auth"|g' app/api/auth/login/route.ts 2>/dev/null || true
sed -i "s|'@/lib/auth'|'../../../../lib/auth'|g" app/api/auth/login/route.ts 2>/dev/null || true
sed -i 's|"@/lib/auth"|"../../../../lib/auth"|g' app/api/auth/login/route.ts 2>/dev/null || true

# app/api/auth/2fa/* - путь ../../../../../lib/ (6 уровней)
for file in app/api/auth/2fa/*/route.ts; do
    if [ -f "$file" ]; then
        sed -i "s|'a/lib/|'../../../../../lib/|g" "$file" 2>/dev/null || true
        sed -i 's|"a/lib/|"../../../../../lib/|g' "$file" 2>/dev/null || true
        sed -i "s|'@/lib/|'../../../../../lib/|g" "$file" 2>/dev/null || true
        sed -i 's|"@/lib/|"../../../../../lib/|g' "$file" 2>/dev/null || true
        sed -i "s|'../../../../lib/|'../../../../../lib/|g" "$file" 2>/dev/null || true
        sed -i 's|"../../../../lib/|"../../../../../lib/|g' "$file" 2>/dev/null || true
    fi
done

# Остальные app/api - путь ../../../../lib/
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|'a/lib/|'../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i 's|"a/lib/|"../../../../lib/|g' {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|'@/lib/|'../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i 's|"@/lib/|"../../../../lib/|g' {} \;

# app/dashboard - путь ../../../lib/
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"../../../lib/|g' {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'@/lib/|'../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"@/lib/|"../../../lib/|g' {} \;

# middleware.ts
sed -i "s|'a/lib/|'./lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|"a/lib/|"./lib/|g' middleware.ts 2>/dev/null || true
sed -i "s|'@/lib/|'./lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|"@/lib/|"./lib/|g' middleware.ts 2>/dev/null || true

# 5. Проверяем проблемные файлы
echo ""
echo "🔍 Проверяю проблемные файлы..."
for file in "app/dashboard/crypto/page.tsx" "app/dashboard/page.tsx" "app/api/channel/settings/route.ts" "app/api/crypto-pay/webhook/route.ts"; do
    if [ -f "$file" ]; then
        echo "  📄 $file:"
        if grep -qE "from ['\"]/|from ['\"]a/|from ['\"]@/" "$file" 2>/dev/null; then
            echo "    ⚠️  Найдены проблемные пути!"
            grep -E "from ['\"]/|from ['\"]a/|from ['\"]@/" "$file" | head -3
        else
            echo "    ✅ Пути правильные"
        fi
    fi
done

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
    echo ""
    echo "🎉 Всё готово!"
else
    echo ""
    echo "❌ Ошибка сборки!"
    echo ""
    echo "🔍 Показываю содержимое проблемных файлов:"
    for file in "app/dashboard/crypto/page.tsx" "app/dashboard/page.tsx"; do
        if [ -f "$file" ]; then
            echo ""
            echo "=== $file (первые 10 строк) ==="
            head -10 "$file"
        fi
    done
    exit 1
fi

