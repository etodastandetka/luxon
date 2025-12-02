#!/bin/bash
# ФИНАЛЬНЫЙ скрипт - исправляет ВСЁ прямо сейчас

set -e

echo "🔧 ФИНАЛЬНОЕ исправление ВСЕХ проблем..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Принудительно обновляем ВСЁ из git
echo "📥 Принудительно обновляю ВСЁ из git..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "✅ Файлы обновлены"
echo ""

# 2. Восстанавливаем ВСЕ файлы из lib/
echo "📥 Восстанавливаю ВСЕ файлы из lib/..."
git checkout origin/main -- lib/ 2>/dev/null || git checkout main -- lib/ 2>/dev/null || true
echo "✅ Файлы lib/ восстановлены"
echo ""

# 3. Исправляем app/dashboard/crypto/page.tsx - там точно остался 'a/components/Layout'
echo "📝 Исправляю app/dashboard/crypto/page.tsx..."
if [ -f "app/dashboard/crypto/page.tsx" ]; then
    # Заменяем ВСЕ варианты
    sed -i "s|from 'a/components/Layout'|from '../../../components/Layout'|g" app/dashboard/crypto/page.tsx
    sed -i 's|from "a/components/Layout"|from "../../../components/Layout"|g' app/dashboard/crypto/page.tsx
    sed -i "s|from '@/components/Layout'|from '../../../components/Layout'|g" app/dashboard/crypto/page.tsx
    sed -i 's|from "@/components/Layout"|from "../../../components/Layout"|g' app/dashboard/crypto/page.tsx
    sed -i "s|from '/components/Layout'|from '../../../components/Layout'|g" app/dashboard/crypto/page.tsx
    sed -i 's|from "/components/Layout"|from "../../../components/Layout"|g' app/dashboard/crypto/page.tsx
    sed -i "s|'a/components/Layout'|'../../../components/Layout'|g" app/dashboard/crypto/page.tsx
    sed -i 's|"a/components/Layout"|"../../../components/Layout"|g' app/dashboard/crypto/page.tsx
    
    # Также исправляем lib/crypto-pay
    sed -i "s|from 'a/lib/crypto-pay'|from '../../../lib/crypto-pay'|g" app/dashboard/crypto/page.tsx
    sed -i 's|from "a/lib/crypto-pay"|from "../../../lib/crypto-pay"|g' app/dashboard/crypto/page.tsx
    sed -i "s|from '@/lib/crypto-pay'|from '../../../lib/crypto-pay'|g" app/dashboard/crypto/page.tsx
    sed -i 's|from "@/lib/crypto-pay"|from "../../../lib/crypto-pay"|g' app/dashboard/crypto/page.tsx
    
    echo "  ✅ Исправлено"
fi

# 4. Исправляем app/api/auth/login/route.ts
echo "📝 Исправляю app/api/auth/login/route.ts..."
if [ -f "app/api/auth/login/route.ts" ]; then
    sed -i "s|'a/lib/auth'|'../../../../lib/auth'|g" app/api/auth/login/route.ts
    sed -i 's|"a/lib/auth"|"../../../../lib/auth"|g' app/api/auth/login/route.ts
    sed -i "s|'@/lib/auth'|'../../../../lib/auth'|g" app/api/auth/login/route.ts
    sed -i 's|"@/lib/auth"|"../../../../lib/auth"|g' app/api/auth/login/route.ts
    echo "  ✅ Исправлено"
fi

# 5. Исправляем app/api/auth/2fa/* - путь ../../../../../lib/ (6 уровней)
echo "📝 Исправляю app/api/auth/2fa/*..."
for file in app/api/auth/2fa/*/route.ts; do
    if [ -f "$file" ]; then
        sed -i "s|'a/lib/|'../../../../../lib/|g" "$file"
        sed -i 's|"a/lib/|"../../../../../lib/|g' "$file"
        sed -i "s|'@/lib/|'../../../../../lib/|g" "$file"
        sed -i 's|"@/lib/|"../../../../../lib/|g' "$file"
        sed -i "s|'../../../../lib/|'../../../../../lib/|g" "$file"
        sed -i 's|"../../../../lib/|"../../../../../lib/|g' "$file"
    fi
done

# 6. Исправляем все остальные файлы
echo "📝 Исправляю все остальные файлы..."
# Пути начинающиеся с /
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '/components/|from '../../../components/|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "/components/|from "../../../components/|g' {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '/lib/|from '../../../../lib/|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "/lib/|from "../../../../lib/|g' {} \;

# Алиасы a/ и @/
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|'a/lib/|'../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i 's|"a/lib/|"../../../../lib/|g' {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i "s|'@/lib/|'../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" -exec sed -i 's|"@/lib/|"../../../../lib/|g' {} \;

find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"../../../lib/|g' {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'@/lib/|'../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"@/lib/|"../../../lib/|g' {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/components/|'../../../components/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/components/|"../../../components/|g' {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'@/components/|'../../../components/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"@/components/|"../../../components/|g' {} \;

sed -i "s|'a/lib/|'./lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|"a/lib/|"./lib/|g' middleware.ts 2>/dev/null || true
sed -i "s|'@/lib/|'./lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|"@/lib/|"./lib/|g' middleware.ts 2>/dev/null || true

# 7. Проверяем проблемные файлы
echo ""
echo "🔍 Проверяю проблемные файлы..."
for file in "app/dashboard/crypto/page.tsx" "app/dashboard/page.tsx" "app/api/auth/login/route.ts"; do
    if [ -f "$file" ]; then
        echo "  📄 $file:"
        if grep -qE "from ['\"]/|from ['\"]a/|from ['\"]@/" "$file" 2>/dev/null; then
            echo "    ⚠️  Найдены проблемные пути!"
            grep -E "from ['\"]/|from ['\"]a/|from ['\"]@/" "$file" | head -3
        else
            echo "    ✅ Пути правильные"
            # Показываем первые импорты для проверки
            head -10 "$file" | grep -E "from|import" | head -3
        fi
    fi
done

# 8. Проверяем наличие всех файлов в lib/
echo ""
echo "🔍 Проверяю наличие файлов в lib/..."
for file in lib/two-factor.ts lib/sounds.ts lib/notifications.ts lib/security.ts lib/auth.ts lib/api-helpers.ts lib/prisma.ts lib/crypto-pay.ts; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file НЕ НАЙДЕН!"
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
    exit 1
fi

