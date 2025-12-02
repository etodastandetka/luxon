#!/bin/bash
# Скрипт для исправления конкретных файлов из ошибок сборки

set -e

echo "🔧 Исправляю конкретные файлы из ошибок сборки..."
echo ""

# Функция для замены
replace_alias() {
    local file="$1"
    local old="$2"
    local new="$3"
    
    if [ -f "$file" ]; then
        if grep -q "$old" "$file" 2>/dev/null; then
            echo "  ✅ Исправляю $file: $old -> $new"
            sed -i "s|$old|$new|g" "$file"
        else
            echo "  ⚠️  В $file не найдено: $old"
        fi
    else
        echo "  ❌ Файл не найден: $file"
    fi
}

# Исправляем app/dashboard/crypto/page.tsx
echo "📝 Исправляю app/dashboard/crypto/page.tsx..."
replace_alias "app/dashboard/crypto/page.tsx" "'a/components/Layout" "'../../../components/Layout"
replace_alias "app/dashboard/crypto/page.tsx" "\"a/components/Layout" "\"../../../components/Layout"
replace_alias "app/dashboard/crypto/page.tsx" "'a/lib/crypto-pay" "'../../../lib/crypto-pay"
replace_alias "app/dashboard/crypto/page.tsx" "\"a/lib/crypto-pay" "\"../../../lib/crypto-pay"

# Исправляем app/dashboard/page.tsx
echo "📝 Исправляю app/dashboard/page.tsx..."
replace_alias "app/dashboard/page.tsx" "'a/lib/sounds" "'../../lib/sounds"
replace_alias "app/dashboard/page.tsx" "\"a/lib/sounds" "\"../../lib/sounds"
replace_alias "app/dashboard/page.tsx" "'a/lib/notifications" "'../../lib/notifications"
replace_alias "app/dashboard/page.tsx" "\"a/lib/notifications" "\"../../lib/notifications"

# Исправляем app/api/auth/login/route.ts
echo "📝 Исправляю app/api/auth/login/route.ts..."
replace_alias "app/api/auth/login/route.ts" "'a/lib/auth" "'../../../../lib/auth"
replace_alias "app/api/auth/login/route.ts" "\"a/lib/auth" "\"../../../../lib/auth"

# Также заменяем все остальные варианты в этих файлах
echo "📝 Заменяю все остальные варианты 'a/lib/' и 'a/components/'..."
for file in "app/dashboard/crypto/page.tsx" "app/dashboard/page.tsx" "app/api/auth/login/route.ts"; do
    if [ -f "$file" ]; then
        sed -i "s|'a/lib/|'../../../../lib/|g" "$file" 2>/dev/null || true
        sed -i "s|\"a/lib/|\"../../../../lib/|g" "$file" 2>/dev/null || true
        sed -i "s|'a/components/|'../../../../components/|g" "$file" 2>/dev/null || true
        sed -i "s|\"a/components/|\"../../../../components/|g" "$file" 2>/dev/null || true
    fi
done

# Исправляем пути в зависимости от расположения файла
echo "📝 Исправляю пути в зависимости от расположения..."
for file in app/dashboard/crypto/page.tsx; do
    if [ -f "$file" ]; then
        # Для app/dashboard/crypto/page.tsx нужен путь ../../../
        sed -i "s|'../../../../lib/|'../../../lib/|g" "$file" 2>/dev/null || true
        sed -i "s|\"../../../../lib/|\"../../../lib/|g" "$file" 2>/dev/null || true
        sed -i "s|'../../../../components/|'../../../components/|g" "$file" 2>/dev/null || true
        sed -i "s|\"../../../../components/|\"../../../components/|g" "$file" 2>/dev/null || true
    fi
done

for file in app/dashboard/page.tsx; do
    if [ -f "$file" ]; then
        # Для app/dashboard/page.tsx нужен путь ../../
        sed -i "s|'../../../../lib/|'../../lib/|g" "$file" 2>/dev/null || true
        sed -i "s|\"../../../../lib/|\"../../lib/|g" "$file" 2>/dev/null || true
        sed -i "s|'../../../../components/|'../../components/|g" "$file" 2>/dev/null || true
        sed -i "s|\"../../../../components/|\"../../components/|g" "$file" 2>/dev/null || true
    fi
done

echo ""
echo "✅ Исправление завершено!"
echo ""
echo "🔍 Проверяю результат..."
for file in "app/dashboard/crypto/page.tsx" "app/dashboard/page.tsx" "app/api/auth/login/route.ts"; do
    if [ -f "$file" ]; then
        count=$(grep -c "a/lib/\|a/components/" "$file" 2>/dev/null || echo "0")
        if [ "$count" -gt 0 ]; then
            echo "⚠️  В $file осталось алиасов: $count"
            grep "a/lib/\|a/components/" "$file" | head -3
        else
            echo "✅ $file исправлен"
        fi
    fi
done

