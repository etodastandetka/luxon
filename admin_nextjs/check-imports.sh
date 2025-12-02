#!/bin/bash
# Скрипт для проверки всех импортов в проблемных файлах

echo "🔍 Проверяю импорты в проблемных файлах..."
echo ""

check_file() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "📄 $file:"
        echo "  Импорты:"
        grep -E "^import|^const.*=.*require|from ['\"]" "$file" | grep -E "lib/|components/" | head -10
        echo ""
        echo "  Есть ли 'a/lib' или 'a/components':"
        if grep -q "a/lib/\|a/components/" "$file" 2>/dev/null; then
            echo "    ⚠️  ДА! Найдены алиасы:"
            grep "a/lib/\|a/components/" "$file" | head -5
        else
            echo "    ✅ Нет алиасов"
        fi
        echo ""
    else
        echo "❌ Файл не найден: $file"
        echo ""
    fi
}

check_file "app/dashboard/crypto/page.tsx"
check_file "app/dashboard/page.tsx"
check_file "app/api/auth/login/route.ts"

echo "🔍 Ищу все файлы с 'a/lib' или 'a/components'..."
results=$(grep -r "a/lib/\|a/components/" app/ lib/ middleware.ts 2>/dev/null | wc -l || echo "0")
echo "Найдено совпадений: $results"

if [ "$results" -gt 0 ]; then
    echo "Примеры:"
    grep -r "a/lib/\|a/components/" app/ lib/ middleware.ts 2>/dev/null | head -10
fi

