#!/bin/bash
# Скрипт для запуска всех ботов

echo "🤖 Запуск ботов..."

# Обновление кода
cd /var/www/luxon
git pull origin main

# ============================================
# БОТЫ ИЗ bot_simple
# ============================================

echo "📦 Настройка bot_simple..."

cd /var/www/luxon/bot_simple

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo "Создание виртуального окружения..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
    pip install -r requirements.txt
fi

# Запуск через PM2
pm2 start ecosystem.config.js

echo "✅ Боты из bot_simple запущены!"

# ============================================
# БОТ 1XBET
# ============================================

echo "📦 Настройка bot_1xbet..."

cd /var/www/luxon/bot_1xbet

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo "Создание виртуального окружения для bot_1xbet..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
    pip install -r requirements.txt
fi

# Запуск бота 1xbet через PM2
pm2 start venv/bin/python --name "luxon-bot-1xbet" -- bot.py

echo "✅ Бот 1xbet запущен!"

# ============================================
# СОХРАНЕНИЕ
# ============================================

pm2 save

echo ""
echo "✅ ВСЕ БОТЫ ЗАПУЩЕНЫ!"
echo ""
echo "📊 Статус:"
pm2 status
echo ""
echo "📝 Логи: pm2 logs"

