#!/bin/bash
# Простой скрипт для замены всех 'a/lib/' на относительные пути

set -e

echo "🔧 Заменяю все алиасы 'a/lib/' и 'a/components/' на относительные пути..."
echo ""

# Находим все файлы с алиасами
files=$(grep -r -l "'a/lib/\|'a/components/\|\"a/lib/\|\"a/components/" app/ lib/ middleware.ts 2>/dev/null || true)

if [ -z "$files" ]; then
    echo "✅ Файлов с алиасами не найдено!"
    exit 0
fi

echo "📋 Найдено файлов для исправления:"
echo "$files" | wc -l
echo ""

# Обрабатываем каждый файл
for file in $files; do
    echo "  📝 Обрабатываю: $file"
    
    # Подсчитываем глубину файла (количество / в пути)
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    
    # Для файлов в app/api/.../route.ts обычно нужен путь ../../../
    # Для файлов в app/dashboard/... обычно нужен путь ../../
    # Для файлов в app/... обычно нужен путь ../
    # Для middleware.ts нужен путь ./
    
    if [[ "$file" == app/api/* ]]; then
        # app/api/... = минимум 3 уровня, добавляем ещё один для route.ts
        relative_path="../../../../"
    elif [[ "$file" == app/dashboard/* ]]; then
        # app/dashboard/... = 2 уровня
        relative_path="../../../"
    elif [[ "$file" == app/* ]]; then
        # app/... = 1 уровень
        relative_path="../../"
    elif [[ "$file" == lib/* ]]; then
        # lib/... = 1 уровень
        relative_path="../"
    elif [[ "$file" == middleware.ts ]]; then
        # middleware.ts в корне
        relative_path="./"
    else
        # По умолчанию
        relative_path="../"
    fi
    
    # Заменяем алиасы
    sed -i "s|'a/lib/|'${relative_path}lib/|g" "$file"
    sed -i "s|\"a/lib/|\"${relative_path}lib/|g" "$file"
    sed -i "s|'a/components/|'${relative_path}components/|g" "$file"
    sed -i "s|\"a/components/|\"${relative_path}components/|g" "$file"
done

echo ""
echo "✅ Замена завершена!"
echo ""
echo "🔍 Проверяю результат..."
remaining=$(grep -r "'a/lib/\|\"a/lib/\|'a/components/\|\"a/components/" app/ lib/ middleware.ts 2>/dev/null | wc -l || echo "0")
if [ "$remaining" -eq 0 ]; then
    echo "✅ Все алиасы успешно заменены!"
else
    echo "⚠️  Осталось импортов с алиасами: $remaining"
    echo "Проверьте вручную:"
    grep -r "'a/lib/\|\"a/lib/\|'a/components/\|\"a/components/" app/ lib/ middleware.ts 2>/dev/null | head -10
fi

