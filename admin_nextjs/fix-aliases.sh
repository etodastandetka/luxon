#!/bin/bash
# Скрипт для замены всех алиасов 'a/lib/' на относительные пути

set -e

echo "🔧 Заменяю все алиасы 'a/lib/' на относительные пути..."
echo ""

# Функция для замены алиасов в файле
fix_file() {
    local file="$1"
    local depth="$2"
    
    # Создаём относительный путь в зависимости от глубины
    local relative_path=""
    for ((i=0; i<depth; i++)); do
        relative_path="../$relative_path"
    done
    
    # Заменяем 'a/lib/' на относительный путь
    if grep -q "'a/lib/" "$file" || grep -q '"a/lib/' "$file"; then
        echo "  📝 Исправляю: $file (глубина: $depth)"
        sed -i "s|'a/lib/|'${relative_path}lib/|g" "$file"
        sed -i "s|\"a/lib/|\"${relative_path}lib/|g" "$file"
        sed -i "s|'a/components/|'${relative_path}components/|g" "$file"
        sed -i "s|\"a/components/|\"${relative_path}components/|g" "$file"
    fi
}

# Обрабатываем файлы в app/api (глубина 3-4 уровня)
find app/api -name "*.ts" -o -name "*.tsx" | while read file; do
    # Подсчитываем глубину: app/api/... = 3 уровня, app/api/.../... = 4 уровня
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    if [ "$depth" -ge 3 ]; then
        # Для app/api/.../route.ts нужен путь ../../../
        fix_file "$file" 3
    fi
done

# Обрабатываем файлы в app/dashboard (глубина 2-3 уровня)
find app/dashboard -name "*.ts" -o -name "*.tsx" | while read file; do
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    if [ "$depth" -ge 2 ]; then
        # Для app/dashboard/... нужен путь ../../
        fix_file "$file" 2
    fi
done

# Обрабатываем файлы в app/ (корневые страницы, глубина 1)
find app -maxdepth 1 -name "*.ts" -o -name "*.tsx" | while read file; do
    if [ -f "$file" ]; then
        fix_file "$file" 1
    fi
done

# Обрабатываем middleware.ts (корневой файл, глубина 0)
if [ -f "middleware.ts" ]; then
    fix_file "middleware.ts" 0
fi

# Обрабатываем файлы в lib/ (если есть импорты друг в друга)
find lib -name "*.ts" -o -name "*.tsx" | while read file; do
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    if [ "$depth" -ge 1 ]; then
        fix_file "$file" 1
    else
        fix_file "$file" 0
    fi
done

echo ""
echo "✅ Замена завершена!"
echo ""
echo "🔍 Проверяю результат..."
grep -r "'a/lib/" app/ lib/ middleware.ts 2>/dev/null | wc -l | xargs -I {} echo "Осталось импортов 'a/lib/': {}"
grep -r '"a/lib/' app/ lib/ middleware.ts 2>/dev/null | wc -l | xargs -I {} echo "Осталось импортов \"a/lib/\": {}"

