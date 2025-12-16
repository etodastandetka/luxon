#!/bin/bash
# Скрипт для диагностики и исправления проблем с ботом

echo "🔍 Диагностика бота LUXON..."
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка 1: Существует ли директория
echo "1️⃣ Проверка директории..."
if [ -d "/var/www/luxon/bot_simple" ]; then
    echo -e "${GREEN}✅ Директория существует${NC}"
    cd /var/www/luxon/bot_simple
else
    echo -e "${RED}❌ Директория /var/www/luxon/bot_simple не найдена${NC}"
    echo "Используется текущая директория: $(pwd)"
    if [ ! -d "bot_simple" ]; then
        echo -e "${RED}❌ Директория bot_simple не найдена в текущей директории${NC}"
        exit 1
    fi
    cd bot_simple
fi

# Проверка 2: Виртуальное окружение
echo ""
echo "2️⃣ Проверка виртуального окружения..."
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️ Виртуальное окружение не найдено, создаю...${NC}"
    python3 -m venv venv
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Виртуальное окружение создано${NC}"
    else
        echo -e "${RED}❌ Ошибка создания виртуального окружения${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Виртуальное окружение существует${NC}"
fi

# Проверка 3: Установка зависимостей
echo ""
echo "3️⃣ Проверка зависимостей..."
source venv/bin/activate
pip install --upgrade pip > /dev/null 2>&1
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Зависимости установлены${NC}"
    else
        echo -e "${RED}❌ Ошибка установки зависимостей${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ Файл requirements.txt не найден${NC}"
fi

# Проверка 4: Файл bot.py
echo ""
echo "4️⃣ Проверка файла bot.py..."
if [ -f "bot.py" ]; then
    echo -e "${GREEN}✅ Файл bot.py существует${NC}"
    
    # Проверка токена
    if grep -q "BOT_TOKEN.*7927891546" bot.py; then
        echo -e "${GREEN}✅ Токен бота найден и корректен${NC}"
    else
        echo -e "${YELLOW}⚠️ Токен бота не найден или неверный${NC}"
        grep "BOT_TOKEN" bot.py | head -1
    fi
else
    echo -e "${RED}❌ Файл bot.py не найден${NC}"
    exit 1
fi

# Проверка 5: Файл security.py
echo ""
echo "5️⃣ Проверка файла security.py..."
if [ -f "security.py" ]; then
    echo -e "${GREEN}✅ Файл security.py существует${NC}"
else
    echo -e "${RED}❌ Файл security.py не найден${NC}"
    exit 1
fi

# Проверка 6: Синтаксис Python
echo ""
echo "6️⃣ Проверка синтаксиса Python..."
python3 -m py_compile bot.py 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Синтаксис Python корректен${NC}"
else
    echo -e "${RED}❌ Ошибка синтаксиса Python${NC}"
    python3 -m py_compile bot.py
    exit 1
fi

# Проверка 7: PM2 статус
echo ""
echo "7️⃣ Проверка PM2 процессов..."
if command -v pm2 &> /dev/null; then
    echo "Текущие процессы PM2:"
    pm2 list | grep -E "luxon-bot|operator_bot" || echo "Боты не запущены в PM2"
    
    # Проверка логов
    echo ""
    echo "Последние ошибки из логов:"
    if pm2 describe luxon-bot &> /dev/null; then
        echo "--- luxon-bot errors ---"
        pm2 logs luxon-bot --err --lines 5 --nostream 2>/dev/null || echo "Нет ошибок"
    fi
else
    echo -e "${YELLOW}⚠️ PM2 не установлен${NC}"
fi

# Проверка 8: Тест импортов
echo ""
echo "8️⃣ Проверка импортов..."
python3 -c "
import sys
sys.path.insert(0, '.')
try:
    from security import rate_limit_decorator
    print('✅ Импорт security успешен')
except Exception as e:
    print(f'❌ Ошибка импорта security: {e}')
    sys.exit(1)

try:
    from telegram import Update
    from telegram.ext import Application
    print('✅ Импорт telegram успешен')
except Exception as e:
    print(f'❌ Ошибка импорта telegram: {e}')
    sys.exit(1)
"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка импортов${NC}"
    exit 1
fi

# Итоговая проверка
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Диагностика завершена${NC}"
echo ""
echo "Для запуска бота выполните:"
echo "  pm2 start ecosystem.config.js"
echo "  или"
echo "  pm2 restart luxon-bot"
echo ""
echo "Для просмотра логов:"
echo "  pm2 logs luxon-bot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

