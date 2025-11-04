#!/bin/bash
# Скрипт для обновления бота с поддержкой рефералок

echo "🔄 Обновление бота с поддержкой рефералок..."

# Переходим в директорию проекта
cd /var/www/luxon

# Получаем последние изменения
echo "📥 Получение последних изменений из Git..."
git pull origin main

# Устанавливаем httpx в виртуальное окружение Django admin
echo "📦 Установка httpx в виртуальное окружение..."
cd django_admin
source venv/bin/activate
pip install httpx==0.27.0
deactivate

# Также устанавливаем в виртуальное окружение bot_simple, если оно есть
cd ../bot_simple
if [ -d "venv" ]; then
    echo "📦 Установка httpx в виртуальное окружение bot_simple..."
    source venv/bin/activate
    pip install httpx==0.27.0
    deactivate
fi

# Возвращаемся в корень
cd /var/www/luxon

# Перезапускаем бота через PM2
echo "🔄 Перезапуск бота через PM2..."
pm2 restart luxon-bot

# Проверяем статус
echo "📊 Статус бота:"
pm2 status luxon-bot

echo "✅ Готово! Бот обновлен и перезапущен."

