#!/bin/bash
# Скрипт для проверки существования файлов на сервере

cd /var/www/luxon/admin_nextjs || exit 1

echo "🔍 Проверяю существование файлов..."
echo ""

# Проверяем lib/
echo "📁 Проверяю lib/:"
if [ -d "lib" ]; then
    echo "  ✅ Папка lib/ существует"
    echo "  📄 Файлы в lib/:"
    ls -la lib/ | grep "\.ts$" | awk '{print "    " $9}'
else
    echo "  ❌ Папка lib/ НЕ существует!"
fi
echo ""

# Проверяем конкретные файлы
echo "📄 Проверяю конкретные файлы:"
files=(
    "lib/sounds.ts"
    "lib/notifications.ts"
    "lib/api-helpers.ts"
    "lib/prisma.ts"
    "lib/deposit-balance.ts"
    "lib/security.ts"
    "lib/two-factor.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - НЕ НАЙДЕН!"
    fi
done
echo ""

# Проверяем пути в проблемных файлах
echo "📝 Проверяю пути в проблемных файлах:"
echo ""
echo "app/dashboard/page.tsx:"
if [ -f "app/dashboard/page.tsx" ]; then
    echo "  Импорты:"
    grep -E "from ['\"].*lib/" app/dashboard/page.tsx | head -5
    echo ""
    echo "  Проверяю путь к sounds.ts:"
    if [ -f "lib/sounds.ts" ]; then
        echo "    ✅ lib/sounds.ts существует"
        echo "    📍 Путь из app/dashboard/page.tsx: ../../../lib/sounds"
        echo "    📍 Реальный путь должен быть: $(realpath lib/sounds.ts 2>/dev/null || echo 'не найден')"
    fi
else
    echo "  ❌ app/dashboard/page.tsx не найден!"
fi
echo ""

echo "app/api/deposit-balance/route.ts:"
if [ -f "app/api/deposit-balance/route.ts" ]; then
    echo "  Импорты:"
    grep -E "from ['\"].*lib/" app/api/deposit-balance/route.ts | head -5
    echo ""
    echo "  Проверяю пути:"
    for lib_file in "api-helpers" "prisma" "deposit-balance"; do
        if [ -f "lib/${lib_file}.ts" ]; then
            echo "    ✅ lib/${lib_file}.ts существует"
        else
            echo "    ❌ lib/${lib_file}.ts НЕ НАЙДЕН!"
        fi
    done
else
    echo "  ❌ app/api/deposit-balance/route.ts не найден!"
fi
echo ""

# Проверяем структуру директорий
echo "📂 Структура директорий:"
echo "  app/"
ls -d app/*/ 2>/dev/null | head -5
echo "  app/dashboard/"
ls -d app/dashboard/*/ 2>/dev/null | head -5
echo "  app/api/"
ls -d app/api/*/ 2>/dev/null | head -10

