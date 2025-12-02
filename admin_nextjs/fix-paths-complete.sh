#!/bin/bash
# ПОЛНОЕ исправление всех путей с правильным подсчётом уровней

set -e

echo "🔧 ПОЛНОЕ исправление всех путей..."
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

# 3. Исправляем app/dashboard/page.tsx - путь должен быть ../../../lib/ (3 уровня)
echo "📝 Исправляю app/dashboard/page.tsx..."
if [ -f "app/dashboard/page.tsx" ]; then
    sed -i "s|from '../../lib/sounds'|from '../../../lib/sounds'|g" app/dashboard/page.tsx
    sed -i 's|from "../../lib/sounds"|from "../../../lib/sounds"|g' app/dashboard/page.tsx
    sed -i "s|from '../../lib/notifications'|from '../../../lib/notifications'|g" app/dashboard/page.tsx
    sed -i 's|from "../../lib/notifications"|from "../../../lib/notifications"|g' app/dashboard/page.tsx
    echo "  ✅ Исправлено"
fi

# 4. Исправляем app/api/deposit-balance/route.ts - путь должен быть ../../../../lib/ (4 уровня)
echo "📝 Исправляю app/api/deposit-balance/route.ts..."
if [ -f "app/api/deposit-balance/route.ts" ]; then
    sed -i "s|from '../../../lib/|from '../../../../lib/|g" app/api/deposit-balance/route.ts
    sed -i 's|from "../../../lib/|from "../../../../lib/|g' app/api/deposit-balance/route.ts
    echo "  ✅ Исправлено"
fi

# 5. Исправляем app/dashboard/crypto/page.tsx
echo "📝 Исправляю app/dashboard/crypto/page.tsx..."
if [ -f "app/dashboard/crypto/page.tsx" ]; then
    sed -i "s|from 'a/components/Layout'|from '../../../components/Layout'|g" app/dashboard/crypto/page.tsx
    sed -i 's|from "a/components/Layout"|from "../../../components/Layout"|g' app/dashboard/crypto/page.tsx
    sed -i "s|from '@/components/Layout'|from '../../../components/Layout'|g" app/dashboard/crypto/page.tsx
    sed -i 's|from "@/components/Layout"|from "../../../components/Layout"|g' app/dashboard/crypto/page.tsx
    sed -i "s|from '/components/Layout'|from '../../../components/Layout'|g" app/dashboard/crypto/page.tsx
    sed -i 's|from "/components/Layout"|from "../../../components/Layout"|g' app/dashboard/crypto/page.tsx
    echo "  ✅ Исправлено"
fi

# 6. Исправляем app/api/auth/login/route.ts
echo "📝 Исправляю app/api/auth/login/route.ts..."
if [ -f "app/api/auth/login/route.ts" ]; then
    sed -i "s|'a/lib/auth'|'../../../../lib/auth'|g" app/api/auth/login/route.ts
    sed -i 's|"a/lib/auth"|"../../../../lib/auth"|g' app/api/auth/login/route.ts
    sed -i "s|'@/lib/auth'|'../../../../lib/auth'|g" app/api/auth/login/route.ts
    sed -i 's|"@/lib/auth"|"../../../../lib/auth"|g' app/api/auth/login/route.ts
    echo "  ✅ Исправлено"
fi

# 7. Исправляем app/api/auth/2fa/* - путь ../../../../../lib/ (6 уровней)
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

# 8. Исправляем неправильные пути (2 уровня вместо 3, 3 вместо 4)
echo "📝 Исправляю неправильные пути в app/dashboard..."
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '../../lib/|from '../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "../../lib/|from "../../../lib/|g' {} \;

echo "📝 Исправляю неправильные пути в app/api..."
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" ! -path "*/crypto-pay/*" ! -path "*/requests/\[*\]/*" ! -path "*/limits/*" ! -path "*/users/\[*\]/*" -exec sed -i "s|from '../../../lib/|from '../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/auth/2fa/*" ! -path "*/crypto-pay/*" ! -path "*/requests/\[*\]/*" ! -path "*/limits/*" ! -path "*/users/\[*\]/*" -exec sed -i 's|from "../../../lib/|from "../../../../lib/|g' {} \;

# 9. Исправляем все остальные файлы (алиасы и абсолютные пути)
echo "📝 Исправляю алиасы и абсолютные пути..."
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

echo ""
echo "✅ Исправление завершено!"
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

