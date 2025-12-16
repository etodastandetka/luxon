#!/bin/bash
# ПОЛНОЕ исправление и сборка с очисткой всего кеша

set -e

echo "🔧 ПОЛНОЕ исправление и сборка проекта..."
echo ""

# 1. Обновляем файлы из git
echo "📥 Обновляю файлы из git..."
git pull origin main
echo "✅ Файлы обновлены"
echo ""

# 2. Исправляем алиасы
echo "🔧 Исправляю алиасы..."
if [ -f "fix-aliases-final.sh" ]; then
    chmod +x fix-aliases-final.sh
    ./fix-aliases-final.sh
else
    echo "⚠️  Скрипт fix-aliases-final.sh не найден, исправляю вручную..."
    
    # Исправляем ошибки с lg
    find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|lib/lg/|lib/|g' {} \; 2>/dev/null || true
    find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|components/lg/|components/|g' {} \; 2>/dev/null || true
    
    # Заменяем алиасы
    find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../../../../lib/|g" {} \;
    find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"../../../../lib/|g' {} \;
    find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../../../lib/|g" {} \;
    find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"../../../lib/|g' {} \;
    find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../../lib/|g" {} \;
    sed -i "s|'a/lib/|'./lib/|g" middleware.ts 2>/dev/null || true
    
    find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/components/|'../../../../components/|g" {} \;
    find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/components/|'../../../components/|g" {} \;
    sed -i "s|'a/components/|'./components/|g" middleware.ts 2>/dev/null || true
fi
echo ""

# 3. ПОЛНАЯ очистка всего кеша
echo "🧹 ПОЛНАЯ очистка кеша..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf tsconfig.tsbuildinfo
rm -rf .swc
rm -rf .turbo
rm -rf .npm
echo "✅ Кеш полностью очищен"
echo ""

# 4. Проверяем конкретные проблемные файлы
echo "🔍 Проверяю проблемные файлы..."
for file in "app/dashboard/crypto/page.tsx" "app/dashboard/page.tsx" "app/api/auth/login/route.ts"; do
    if [ -f "$file" ]; then
        echo "  📄 $file:"
        if grep -q "a/lib/\|a/components/" "$file" 2>/dev/null; then
            echo "    ⚠️  Найдены алиасы!"
            grep "a/lib/\|a/components/" "$file" | head -3
        else
            echo "    ✅ Алиасов не найдено"
        fi
    fi
done
echo ""

# 5. Проверяем импорты в проблемных файлах
echo "🔍 Проверяю импорты в проблемных файлах..."
echo "  app/dashboard/crypto/page.tsx:"
grep -E "from ['\"].*lib/|from ['\"].*components/" app/dashboard/crypto/page.tsx 2>/dev/null | head -5 || echo "    Файл не найден или нет импортов"
echo ""
echo "  app/dashboard/page.tsx:"
grep -E "from ['\"].*lib/|from ['\"].*components/" app/dashboard/page.tsx 2>/dev/null | head -5 || echo "    Файл не найден или нет импортов"
echo ""
echo "  app/api/auth/login/route.ts:"
grep -E "from ['\"].*lib/" app/api/auth/login/route.ts 2>/dev/null | head -5 || echo "    Файл не найден или нет импортов"
echo ""

# 6. Собираем проект
echo "📦 Запускаю сборку..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Сборка успешна!"
    echo ""
    echo "🔄 Перезапускаю PM2 процесс..."
    pm2 restart luxon-admin
    echo ""
    echo "📊 Статус PM2:"
    pm2 list
    echo ""
    echo "🎉 Всё готово!"
else
    echo ""
    echo "❌ Ошибка сборки!"
    echo ""
    echo "🔍 Проверяю, какие файлы всё ещё содержат алиасы:"
    grep -r "a/lib/\|a/components/" app/ lib/ middleware.ts 2>/dev/null | head -10 || echo "Алиасов не найдено"
    exit 1
fi

