#!/bin/bash
# Прямое исправление файлов с принудительным обновлением из git

set -e

echo "🔧 Прямое исправление файлов..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Принудительно обновляем ВСЁ из git
echo "📥 Принудительно обновляю ВСЁ из git..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "✅ Файлы обновлены"
echo ""

# 2. Проверяем существование lib/two-factor.ts
echo "🔍 Проверяю существование lib/two-factor.ts..."
if [ -f "lib/two-factor.ts" ]; then
    echo "  ✅ lib/two-factor.ts существует"
else
    echo "  ❌ lib/two-factor.ts НЕ НАЙДЕН!"
    echo "  Список файлов в lib/:"
    ls -la lib/ | head -10
    exit 1
fi

# 3. Показываем содержимое проблемных файлов
echo ""
echo "🔍 Содержимое файлов ДО исправления:"
echo ""
echo "=== app/api/auth/login/route.ts (строки 1-5) ==="
head -5 app/api/auth/login/route.ts
echo ""
echo "=== app/api/auth/2fa/disable/route.ts (строки 1-10) ==="
head -10 app/api/auth/2fa/disable/route.ts
echo ""

# 4. Исправляем app/api/auth/login/route.ts - заменяем ВСЕ варианты
echo "📝 Исправляю app/api/auth/login/route.ts..."
if [ -f "app/api/auth/login/route.ts" ]; then
    # Используем более агрессивную замену
    sed -i "s|'a/lib/auth'|'../../../../lib/auth'|g" app/api/auth/login/route.ts
    sed -i 's|"a/lib/auth"|"../../../../lib/auth"|g' app/api/auth/login/route.ts
    sed -i "s|'@/lib/auth'|'../../../../lib/auth'|g" app/api/auth/login/route.ts
    sed -i 's|"@/lib/auth"|"../../../../lib/auth"|g' app/api/auth/login/route.ts
    sed -i "s|from 'a/lib/auth'|from '../../../../lib/auth'|g" app/api/auth/login/route.ts
    sed -i 's|from "a/lib/auth"|from "../../../../lib/auth"|g' app/api/auth/login/route.ts
    sed -i "s|from '@/lib/auth'|from '../../../../lib/auth'|g" app/api/auth/login/route.ts
    sed -i 's|from "@/lib/auth"|from "../../../../lib/auth"|g' app/api/auth/login/route.ts
    echo "  ✅ Исправлено"
fi

# 5. Исправляем app/api/auth/2fa/* - путь ../../../../../lib/ (6 уровней)
echo "📝 Исправляю app/api/auth/2fa/*..."
for file in app/api/auth/2fa/*/route.ts; do
    if [ -f "$file" ]; then
        echo "  ✅ Исправляю $file"
        # Заменяем все варианты алиасов
        sed -i "s|'a/lib/|'../../../../../lib/|g" "$file"
        sed -i 's|"a/lib/|"../../../../../lib/|g' "$file"
        sed -i "s|'@/lib/|'../../../../../lib/|g" "$file"
        sed -i 's|"@/lib/|"../../../../../lib/|g' "$file"
        sed -i "s|from 'a/lib/|from '../../../../../lib/|g" "$file"
        sed -i 's|from "a/lib/|from "../../../../../lib/|g' "$file"
        sed -i "s|from '@/lib/|from '../../../../../lib/|g" "$file"
        sed -i 's|from "@/lib/|from "../../../../../lib/|g' "$file"
        # Исправляем неправильные пути ../../../../lib/ на ../../../../../lib/
        sed -i "s|'../../../../lib/|'../../../../../lib/|g" "$file"
        sed -i 's|"../../../../lib/|"../../../../../lib/|g' "$file"
    fi
done

# 6. Исправляем остальные файлы
echo "📝 Исправляю остальные файлы..."
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

# 7. Показываем содержимое ПОСЛЕ исправления
echo ""
echo "🔍 Содержимое файлов ПОСЛЕ исправления:"
echo ""
echo "=== app/api/auth/login/route.ts (строки 1-5) ==="
head -5 app/api/auth/login/route.ts
echo ""
echo "=== app/api/auth/2fa/disable/route.ts (строки 1-10) ==="
head -10 app/api/auth/2fa/disable/route.ts
echo ""

# 8. Проверяем наличие алиасов
echo "🔍 Проверяю наличие алиасов..."
for file in "app/api/auth/login/route.ts" "app/api/auth/2fa/disable/route.ts" "app/api/auth/2fa/enable/route.ts"; do
    if [ -f "$file" ]; then
        if grep -qE "['\"]a/lib/|['\"]@/lib/" "$file" 2>/dev/null; then
            echo "  ⚠️  $file: НАЙДЕНЫ алиасы!"
            grep -E "['\"]a/lib/|['\"]@/lib/" "$file" | head -3
        else
            echo "  ✅ $file: алиасов нет"
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
    echo "🔍 Показываю полное содержимое проблемных файлов:"
    echo ""
    echo "=== app/api/auth/login/route.ts ==="
    cat app/api/auth/login/route.ts
    echo ""
    echo "=== app/api/auth/2fa/disable/route.ts ==="
    cat app/api/auth/2fa/disable/route.ts
    exit 1
fi

