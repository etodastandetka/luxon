#!/bin/bash
# Полный скрипт для замены всех вариантов алиасов на относительные пути

set -e

echo "🔧 Заменяю все варианты алиасов на относительные пути..."
echo ""

# Функция для замены в файле
fix_file() {
    local file="$1"
    local relative_path="$2"
    
    if [ ! -f "$file" ]; then
        return
    fi
    
    # Проверяем, есть ли алиасы в файле
    if grep -q "a/lib/\|a/components/" "$file" 2>/dev/null; then
        echo "  📝 Исправляю: $file"
        
        # Заменяем все варианты:
        # 'a/lib/ -> относительный путь
        # "a/lib/ -> относительный путь
        # 'a/components/ -> относительный путь
        # "a/components/ -> относительный путь
        
        sed -i "s|'a/lib/|'${relative_path}lib/|g" "$file"
        sed -i "s|\"a/lib/|\"${relative_path}lib/|g" "$file"
        sed -i "s|'a/components/|'${relative_path}components/|g" "$file"
        sed -i "s|\"a/components/|\"${relative_path}components/|g" "$file"
        
        # Также заменяем варианты без кавычек (на случай если есть)
        sed -i "s|from a/lib/|from ${relative_path}lib/|g" "$file"
        sed -i "s|from a/components/|from ${relative_path}components/|g" "$file"
    fi
}

# Обрабатываем файлы в app/api
echo "📁 Обрабатываю app/api/..."
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
    # Для app/api/.../route.ts нужен путь ../../../
    fix_file "$file" "../../../../"
done

# Обрабатываем файлы в app/dashboard
echo "📁 Обрабатываю app/dashboard/..."
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
    # Для app/dashboard/... нужен путь ../../
    fix_file "$file" "../../../"
done

# Обрабатываем файлы в app/ (корневые)
echo "📁 Обрабатываю app/ (корневые файлы)..."
find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
    fix_file "$file" "../../"
done

# Обрабатываем middleware.ts
echo "📁 Обрабатываю middleware.ts..."
fix_file "middleware.ts" "./"

# Обрабатываем файлы в lib/
echo "📁 Обрабатываю lib/..."
find lib -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
    if [[ "$file" == lib/* ]]; then
        fix_file "$file" "../"
    else
        fix_file "$file" "./"
    fi
done

echo ""
echo "✅ Замена завершена!"
echo ""
echo "🔍 Проверяю результат..."
echo ""

# Ищем все возможные варианты алиасов
patterns=("a/lib/" "a/components/")

for pattern in "${patterns[@]}"; do
    count=$(grep -r "$pattern" app/ lib/ middleware.ts 2>/dev/null | wc -l || echo "0")
    if [ "$count" -gt 0 ]; then
        echo "⚠️  Найдено импортов с '$pattern': $count"
        echo "Примеры:"
        grep -r "$pattern" app/ lib/ middleware.ts 2>/dev/null | head -5
        echo ""
    else
        echo "✅ Импортов с '$pattern' не найдено"
    fi
done

echo ""
echo "🎉 Готово!"

