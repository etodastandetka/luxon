#!/bin/bash
# Агрессивный скрипт для замены ВСЕХ вариантов алиасов 'a/' на относительные пути

set -e

echo "🔧 АГРЕССИВНАЯ замена всех алиасов 'a/' на относительные пути..."
echo ""

# Функция для замены в файле
fix_file() {
    local file="$1"
    local relative_path="$2"
    
    if [ ! -f "$file" ]; then
        return
    fi
    
    # Проверяем, есть ли вообще 'a/' в файле
    if grep -q "a/lib/\|a/components/" "$file" 2>/dev/null; then
        echo "  📝 Исправляю: $file -> $relative_path"
        
        # Заменяем ВСЕ варианты с разными кавычками и без
        sed -i "s|'a/lib/|'${relative_path}lib/|g" "$file"
        sed -i "s|\"a/lib/|\"${relative_path}lib/|g" "$file"
        sed -i "s|'a/components/|'${relative_path}components/|g" "$file"
        sed -i "s|\"a/components/|\"${relative_path}components/|g" "$file"
        
        # Также заменяем варианты без кавычек (на случай если есть)
        sed -i "s|from a/lib/|from ${relative_path}lib/|g" "$file"
        sed -i "s|from a/components/|from ${relative_path}components/|g" "$file"
        sed -i "s|import.*a/lib/|import.*${relative_path}lib/|g" "$file"
        sed -i "s|import.*a/components/|import.*${relative_path}components/|g" "$file"
        
        # Заменяем даже если есть пробелы
        sed -i "s| a/lib/| ${relative_path}lib/|g" "$file"
        sed -i "s| a/components/| ${relative_path}components/|g" "$file"
    fi
}

# Обрабатываем ВСЕ файлы в app/api
echo "📁 Обрабатываю app/api/..."
find app/api -type f \( -name "*.ts" -o -name "*.tsx" \) -exec bash -c 'fix_file "$0" "../../../../"' {} \;

# Обрабатываем ВСЕ файлы в app/dashboard
echo "📁 Обрабатываю app/dashboard/..."
find app/dashboard -type f \( -name "*.ts" -o -name "*.tsx" \) -exec bash -c 'fix_file "$0" "../../../"' {} \;

# Обрабатываем файлы в app/ (корневые)
echo "📁 Обрабатываю app/ (корневые файлы)..."
find app -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -exec bash -c 'fix_file "$0" "../../"' {} \;

# Обрабатываем middleware.ts
echo "📁 Обрабатываю middleware.ts..."
fix_file "middleware.ts" "./"

# Обрабатываем файлы в lib/
echo "📁 Обрабатываю lib/..."
find lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec bash -c 'fix_file "$0" "../"' {} \;

echo ""
echo "✅ Замена завершена!"
echo ""
echo "🔍 Проверяю результат..."
echo ""

# Ищем все возможные варианты
echo "Проверяю наличие 'a/lib/' или 'a/components/' в файлах:"
found=0

# Проверяем каждый файл отдельно
for pattern in "a/lib/" "a/components/"; do
    matches=$(grep -r "$pattern" app/ lib/ middleware.ts 2>/dev/null | wc -l || echo "0")
    if [ "$matches" -gt 0 ]; then
        echo "⚠️  Найдено импортов с '$pattern': $matches"
        grep -r "$pattern" app/ lib/ middleware.ts 2>/dev/null | head -10
        found=1
    else
        echo "✅ Импортов с '$pattern' не найдено"
    fi
done

if [ "$found" -eq 0 ]; then
    echo ""
    echo "🎉 Все алиасы успешно заменены!"
else
    echo ""
    echo "⚠️  Остались файлы с алиасами. Проверьте вручную."
fi

