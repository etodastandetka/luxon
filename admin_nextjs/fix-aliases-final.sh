#!/bin/bash
# ФИНАЛЬНЫЙ надёжный скрипт для исправления всех алиасов

set -e

echo "🔧 ФИНАЛЬНОЕ исправление всех алиасов 'a/lib/' и 'a/components/'..."
echo ""

# Сначала исправляем ошибки с lg
echo "🧹 Исправляю ошибки lib/lg -> lib/..."
find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|lib/lg/|lib/|g' {} \; 2>/dev/null || true
find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|components/lg/|components/|g' {} \; 2>/dev/null || true
echo "✅ Ошибки исправлены"
echo ""

# Заменяем ВСЕ варианты 'a/lib/' и "a/lib/" на правильные пути
echo "📝 Заменяю 'a/lib/' в app/api/..."
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../../../../lib/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"../../../../lib/|g' {} \;

echo "📝 Заменяю 'a/lib/' в app/dashboard/..."
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../../../lib/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"../../../lib/|g' {} \;

echo "📝 Заменяю 'a/lib/' в app/ (корневые)..."
find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../../lib/|g" {} \;
find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"../../lib/|g' {} \;

echo "📝 Заменяю 'a/lib/' в middleware.ts..."
sed -i "s|'a/lib/|'./lib/|g" middleware.ts 2>/dev/null || true
sed -i 's|"a/lib/|"./lib/|g' middleware.ts 2>/dev/null || true

echo "📝 Заменяю 'a/lib/' в lib/..."
find lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/lib/|'../lib/|g" {} \;
find lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/lib/|"../lib/|g' {} \;

# Заменяем 'a/components/'
echo "📝 Заменяю 'a/components/' в app/api/..."
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/components/|'../../../../components/|g" {} \;
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/components/|"../../../../components/|g' {} \;

echo "📝 Заменяю 'a/components/' в app/dashboard/..."
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/components/|'../../../components/|g" {} \;
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/components/|"../../../components/|g' {} \;

echo "📝 Заменяю 'a/components/' в app/ (корневые)..."
find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|'a/components/|'../../components/|g" {} \;
find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|"a/components/|"../../components/|g' {} \;

echo "📝 Заменяю 'a/components/' в middleware.ts..."
sed -i "s|'a/components/|'./components/|g" middleware.ts 2>/dev/null || true
sed -i 's|"a/components/|"./components/|g' middleware.ts 2>/dev/null || true

echo ""
echo "✅ Замена завершена!"
echo ""
echo "🔍 Проверяю результат..."
echo ""

# Проверяем результат
count_a_lib=$(grep -r "a/lib/" app/ lib/ middleware.ts 2>/dev/null | wc -l || echo "0")
count_a_components=$(grep -r "a/components/" app/ lib/ middleware.ts 2>/dev/null | wc -l || echo "0")

if [ "$count_a_lib" -eq 0 ] && [ "$count_a_components" -eq 0 ]; then
    echo "✅ Все алиасы успешно заменены!"
    echo "✅ a/lib/: 0"
    echo "✅ a/components/: 0"
else
    echo "⚠️  Осталось алиасов:"
    echo "   a/lib/: $count_a_lib"
    echo "   a/components/: $count_a_components"
    echo ""
    echo "Примеры:"
    grep -r "a/lib/\|a/components/" app/ lib/ middleware.ts 2>/dev/null | head -5
fi

echo ""
echo "🎉 Готово!"

