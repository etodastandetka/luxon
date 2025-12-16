#!/bin/bash
# Скрипт для принудительного исправления и проверки

set -e

echo "🔧 Принудительное исправление и проверка..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Принудительно обновляем файлы из git
echo "📥 Принудительно обновляю файлы из git..."
git fetch origin main
git reset --hard origin/main
echo "✅ Файлы обновлены"
echo ""

# 2. Показываем содержимое проблемных файлов ДО исправления
echo "🔍 Содержимое файлов ДО исправления:"
echo ""
echo "=== app/api/auth/login/route.ts (первые 5 строк) ==="
head -5 app/api/auth/login/route.ts | grep -E "from|import" || echo "Нет импортов в первых 5 строках"
echo ""
echo "=== app/api/auth/2fa/disable/route.ts (первые 10 строк) ==="
head -10 app/api/auth/2fa/disable/route.ts | grep -E "from|import" || echo "Нет импортов в первых 10 строках"
echo ""

# 3. Исправляем app/api/auth/login/route.ts
echo "📝 Исправляю app/api/auth/login/route.ts..."
if [ -f "app/api/auth/login/route.ts" ]; then
    # Заменяем ВСЕ возможные варианты
    sed -i "s|from ['\"]@/lib/auth|from '../../../../lib/auth|g" app/api/auth/login/route.ts
    sed -i "s|from ['\"]a/lib/auth|from '../../../../lib/auth|g" app/api/auth/login/route.ts
    sed -i "s|from ['\"]@/lib/|from '../../../../lib/|g" app/api/auth/login/route.ts
    sed -i "s|from ['\"]a/lib/|from '../../../../lib/|g" app/api/auth/login/route.ts
    echo "  ✅ Исправлено"
fi

# 4. Исправляем app/api/auth/2fa/* - путь ../../../../../lib/ (6 уровней)
echo "📝 Исправляю app/api/auth/2fa/*..."
for file in app/api/auth/2fa/*/route.ts; do
    if [ -f "$file" ]; then
        echo "  ✅ Исправляю $file"
        # Заменяем все варианты
        sed -i "s|from ['\"]a/lib/|from '../../../../../lib/|g" "$file"
        sed -i "s|from ['\"]@/lib/|from '../../../../../lib/|g" "$file"
        sed -i "s|from ['\"]a/components/|from '../../../../../components/|g" "$file"
        sed -i "s|from ['\"]@/components/|from '../../../../../components/|g" "$file"
        # Исправляем неправильные пути
        sed -i "s|from '../../../../lib/|from '../../../../../lib/|g" "$file"
        sed -i 's|from "../../../../lib/|from "../../../../../lib/|g' "$file"
    fi
done

# 5. Исправляем остальные файлы
echo "📝 Исправляю остальные файлы..."
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|from ['\"]a/lib/|from '../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|from ['\"]@/lib/|from '../../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]a/lib/|from '../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/lib/|from '../../../lib/|g" {} \;
sed -i "s|from ['\"]a/lib/|from './lib/|g" middleware.ts 2>/dev/null || true
sed -i "s|from ['\"]@/lib/|from './lib/|g" middleware.ts 2>/dev/null || true

# 6. Показываем содержимое ПОСЛЕ исправления
echo ""
echo "🔍 Содержимое файлов ПОСЛЕ исправления:"
echo ""
echo "=== app/api/auth/login/route.ts (первые 5 строк) ==="
head -5 app/api/auth/login/route.ts | grep -E "from|import" || echo "Нет импортов"
echo ""
echo "=== app/api/auth/2fa/disable/route.ts (первые 10 строк) ==="
head -10 app/api/auth/2fa/disable/route.ts | grep -E "from|import" || echo "Нет импортов"
echo ""

# 7. Проверяем наличие алиасов
echo "🔍 Ищу все алиасы в проблемных файлах..."
for file in "app/api/auth/login/route.ts" "app/api/auth/2fa/disable/route.ts" "app/api/auth/2fa/enable/route.ts"; do
    if [ -f "$file" ]; then
        if grep -q "from ['\"]a/\|from ['\"]@/" "$file" 2>/dev/null; then
            echo "  ⚠️  $file: НАЙДЕНЫ алиасы!"
            grep "from ['\"]a/\|from ['\"]@/" "$file"
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
    head -10 app/api/auth/login/route.ts
    echo ""
    echo "=== app/api/auth/2fa/disable/route.ts ==="
    head -10 app/api/auth/2fa/disable/route.ts
    exit 1
fi

