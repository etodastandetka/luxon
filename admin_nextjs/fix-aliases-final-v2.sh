#!/bin/bash
# ФИНАЛЬНАЯ версия 2 - исправляет ВСЁ правильно

set -e

echo "🔧 ФИНАЛЬНОЕ исправление всех алиасов (v2)..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# Обновляем файлы
git pull origin main

# 1. Исправляем app/api/auth/login/route.ts - там точно остался @/lib/auth
echo "📝 Исправляю app/api/auth/login/route.ts..."
if [ -f "app/api/auth/login/route.ts" ]; then
    # Заменяем ВСЕ варианты включая @/
    sed -i "s|from ['\"]@/lib/auth|from '../../../../lib/auth|g" app/api/auth/login/route.ts
    sed -i "s|from ['\"]a/lib/auth|from '../../../../lib/auth|g" app/api/auth/login/route.ts
    sed -i "s|from ['\"]@/lib/|from '../../../../lib/|g" app/api/auth/login/route.ts
    sed -i "s|from ['\"]a/lib/|from '../../../../lib/|g" app/api/auth/login/route.ts
    echo "  ✅ Исправлено"
fi

# 2. Исправляем app/api/auth/2fa/* - там нужен путь ../../../../../lib/ (6 уровней!)
echo "📝 Исправляю app/api/auth/2fa/* (6 уровней вверх)..."
for file in app/api/auth/2fa/*/route.ts; do
    if [ -f "$file" ]; then
        echo "  ✅ Исправляю $file"
        # Заменяем на правильный путь (6 уровней вверх)
        sed -i "s|from ['\"]a/lib/|from '../../../../../lib/|g" "$file"
        sed -i "s|from ['\"]@/lib/|from '../../../../../lib/|g" "$file"
        sed -i "s|from ['\"]a/components/|from '../../../../../components/|g" "$file"
        sed -i "s|from ['\"]@/components/|from '../../../../../components/|g" "$file"
        # Также исправляем неправильные пути ../../../../lib/ на ../../../../../lib/
        sed -i "s|from '../../../../lib/|from '../../../../../lib/|g" "$file"
        sed -i 's|from "../../../../lib/|from "../../../../../lib/|g' "$file"
    fi
done

# 3. Исправляем ВСЕ файлы в app/api (4 уровня вверх для большинства, но НЕ 2fa)
echo "📝 Исправляю все файлы в app/api/ (кроме 2fa)..."
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|from ['\"]a/lib/|from '../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|from ['\"]@/lib/|from '../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|from ['\"]a/components/|from '../../../../components/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|from ['\"]@/components/|from '../../../../components/|g" {} \;

# 4. Исправляем app/dashboard (3 уровня вверх)
echo "📝 Исправляю все файлы в app/dashboard/..."
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]a/lib/|from '../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/lib/|from '../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]a/components/|from '../../../components/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/components/|from '../../../components/|g" {} \;

# 5. Исправляем middleware.ts
echo "📝 Исправляю middleware.ts..."
sed -i "s|from ['\"]a/lib/|from './lib/|g" middleware.ts 2>/dev/null || true
sed -i "s|from ['\"]@/lib/|from './lib/|g" middleware.ts 2>/dev/null || true

# 6. Исправляем ошибки с lg
echo "🧹 Исправляю ошибки lib/lg..."
find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|lib/lg/|lib/|g' {} \; 2>/dev/null || true
find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|components/lg/|components/|g' {} \; 2>/dev/null || true

echo ""
echo "✅ Исправление завершено!"
echo ""
echo "🔍 Проверяю проблемные файлы..."
echo ""

# Проверяем конкретные файлы из ошибок
check_file() {
    local file="$1"
    if [ -f "$file" ]; then
        # Исправленная проверка
        if grep -q "from ['\"]a/\|from ['\"]@/" "$file" 2>/dev/null; then
            echo "  ⚠️  $file: найдены алиасы"
            grep "from ['\"]a/\|from ['\"]@/" "$file" 2>/dev/null | head -3
        else
            echo "  ✅ $file: алиасов нет"
        fi
    else
        echo "  ❌ $file: файл не найден"
    fi
}

check_file "app/api/auth/login/route.ts"
check_file "app/api/auth/2fa/disable/route.ts"
check_file "app/api/auth/2fa/enable/route.ts"
check_file "app/dashboard/crypto/page.tsx"
check_file "app/dashboard/page.tsx"

echo ""
echo "🔍 Проверяю общее количество алиасов..."
count=$(grep -r "from ['\"]a/\|from ['\"]@/" app/ lib/ middleware.ts 2>/dev/null | wc -l)

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
        echo ""
        echo "🎉 Всё готово!"
    else
        echo ""
        echo "❌ Ошибка сборки!"
        echo ""
        echo "🔍 Проверяю проблемные файлы вручную..."
        echo "app/api/auth/login/route.ts:"
        head -5 app/api/auth/login/route.ts | grep -E "from|import"
        echo ""
        echo "app/api/auth/2fa/disable/route.ts:"
        head -10 app/api/auth/2fa/disable/route.ts | grep -E "from|import"
        exit 1
    fi
else
    echo "⚠️  Осталось алиасов: $count"
    echo "Примеры:"
    grep -r "from ['\"]a/\|from ['\"]@/" app/ lib/ middleware.ts 2>/dev/null | head -10
fi

