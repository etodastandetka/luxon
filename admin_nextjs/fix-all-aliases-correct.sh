#!/bin/bash
# ПРАВИЛЬНЫЙ скрипт для замены всех 'a/lib/' и 'a/components/' на относительные пути

set -e

echo "🔧 Исправляю ВСЕ алиасы 'a/lib/' и 'a/components/'..."
echo ""

# Сначала исправляем неправильные замены (lib/lg -> lib/)
echo "🧹 Исправляю предыдущие ошибки (lib/lg -> lib/)..."
find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|lib/lg/|lib/|g' {} \;
find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|components/lg/|components/|g' {} \;
echo "✅ Ошибки исправлены"
echo ""

# Функция для правильной замены
fix_file() {
    local file="$1"
    local relative_path="$2"
    
    if [ ! -f "$file" ]; then
        return
    fi
    
    # Заменяем все варианты
    sed -i "s|'a/lib/|'${relative_path}lib/|g" "$file"
    sed -i "s|\"a/lib/|\"${relative_path}lib/|g" "$file"
    sed -i "s|'a/components/|'${relative_path}components/|g" "$file"
    sed -i "s|\"a/components/|\"${relative_path}components/|g" "$file"
}

# Обрабатываем app/api - нужен путь ../../../../lib/
echo "📁 Обрабатываю app/api/..."
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
    fix_file "$file" "../../../../"
done

# Обрабатываем app/dashboard - нужен путь ../../../lib/
echo "📁 Обрабатываю app/dashboard/..."
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
    fix_file "$file" "../../../"
done

# Обрабатываем другие файлы в app/ - нужен путь ../../lib/
echo "📁 Обрабатываю app/ (остальные файлы)..."
find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
    fix_file "$file" "../../"
done

# Обрабатываем middleware.ts - нужен путь ./lib/
echo "📁 Обрабатываю middleware.ts..."
fix_file "middleware.ts" "./"

# Обрабатываем lib/ - нужен путь ../lib/
echo "📁 Обрабатываю lib/..."
find lib -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
    fix_file "$file" "../"
done

echo ""
echo "✅ Замена завершена!"
echo ""
echo "🔍 Проверяю результат..."
remaining=$(grep -r "a/lib/\|a/components/" app/ lib/ middleware.ts 2>/dev/null | wc -l || echo "0")

if [ "$remaining" -eq 0 ]; then
    echo "✅ Все алиасы успешно заменены!"
    echo ""
    echo "🔍 Проверяю на наличие lib/lg или components/lg (ошибки)..."
    errors=$(grep -r "lib/lg/\|components/lg/" app/ lib/ middleware.ts 2>/dev/null | wc -l || echo "0")
    if [ "$errors" -gt 0 ]; then
        echo "⚠️  Найдено ошибок с lg: $errors"
        grep -r "lib/lg/\|components/lg/" app/ lib/ middleware.ts 2>/dev/null | head -5
        echo "Исправляю..."
        find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|lib/lg/|lib/|g' {} \;
        find app lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|components/lg/|components/|g' {} \;
        echo "✅ Ошибки исправлены"
    else
        echo "✅ Ошибок с lg не найдено"
    fi
else
    echo "⚠️  Осталось импортов с алиасами: $remaining"
    echo "Примеры:"
    grep -r "a/lib/\|a/components/" app/ lib/ middleware.ts 2>/dev/null | head -10
fi

echo ""
echo "🎉 Готово!"

