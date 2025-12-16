#!/bin/bash
# Исправление с добавлением расширений .ts в импорты (если нужно)

set -e

echo "🔧 Исправление путей с проверкой расширений..."
echo ""

cd /var/www/luxon/admin_nextjs || exit 1

# 1. Обновляем из git
echo "📥 Обновляю из git..."
git fetch origin main
git reset --hard origin/main
git clean -fd
echo "✅ Обновлено"
echo ""

# 2. Проверяем файлы
echo "📁 Проверяю файлы lib/:"
for file in lib/*.ts; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - НЕ НАЙДЕН!"
    fi
done
echo ""

# 3. Проверяем реальные пути
echo "🔍 Проверяю реальные пути:"
echo "  Текущая директория: $(pwd)"
echo "  lib/ существует: $([ -d "lib" ] && echo "да" || echo "нет")"
echo "  lib/sounds.ts существует: $([ -f "lib/sounds.ts" ] && echo "да" || echo "нет")"
echo "  Путь к lib/sounds.ts: $(realpath lib/sounds.ts 2>/dev/null || echo "не найден")"
echo ""

# 4. Показываем примеры импортов
echo "📝 Текущие импорты:"
echo "app/dashboard/page.tsx:"
grep -E "from ['\"].*lib/" app/dashboard/page.tsx | head -2
echo ""
echo "app/api/deposit-balance/route.ts:"
grep -E "from ['\"].*lib/" app/api/deposit-balance/route.ts | head -3
echo ""

# 5. Пробуем добавить расширения .ts (если их нет)
echo "📝 Пробую добавить расширения .ts в импорты..."
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '\(\.\.\/\)*lib/\([^']*\)'|from '\1lib/\2.ts'|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|from "\(\.\.\/\)*lib/\([^"]*\)"|from "\1lib/\2.ts"|g' {} \;
echo "✅ Расширения добавлены (если были нужны)"
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
    echo "🔍 Дополнительная диагностика:"
    echo "Проверьте структуру:"
    ls -la lib/ | head -10
    echo ""
    echo "Проверьте пути в файлах:"
    echo "app/dashboard/page.tsx:"
    head -15 app/dashboard/page.tsx | grep -E "(import|from)"
    echo ""
    echo "app/api/deposit-balance/route.ts:"
    head -5 app/api/deposit-balance/route.ts
    exit 1
fi

