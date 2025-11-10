#!/bin/bash

# Скрипт для установки и запуска bot_1xbet на сервере

set -e  # Остановить выполнение при ошибке

echo "🚀 Начинаем установку bot_1xbet..."

# 1. Перейти в директорию проекта
cd /var/www/luxon
echo "✅ Перешли в /var/www/luxon"

# 2. Получить последние изменения из git
echo "📥 Получаем последние изменения из git..."
git pull origin main
echo "✅ Git pull выполнен"

# 3. Перейти в папку bot_1xbet
cd bot_1xbet
echo "✅ Перешли в bot_1xbet"

# 4. Создать виртуальное окружение (если еще не создано)
if [ ! -d "venv" ]; then
    echo "📦 Создаем виртуальное окружение..."
    python3 -m venv venv
    echo "✅ Виртуальное окружение создано"
else
    echo "✅ Виртуальное окружение уже существует"
fi

# 5. Активировать виртуальное окружение
echo "🔌 Активируем виртуальное окружение..."
source venv/bin/activate

# 6. Обновить pip
echo "📦 Обновляем pip..."
pip install --upgrade pip

# 7. Установить зависимости
echo "📦 Устанавливаем зависимости..."
pip install -r requirements.txt
echo "✅ Зависимости установлены"

# 8. Остановить бота, если он уже запущен
echo "🛑 Проверяем, не запущен ли бот..."
pm2 delete luxon-bot-1xbet 2>/dev/null || echo "Бот не был запущен ранее"

# 9. Запустить бота через PM2
echo "🚀 Запускаем бота через PM2..."
pm2 start bot.py --name "luxon-bot-1xbet" --interpreter python3
echo "✅ Бот запущен"

# 10. Сохранить конфигурацию PM2
echo "💾 Сохраняем конфигурацию PM2..."
pm2 save
echo "✅ Конфигурация сохранена"

# 11. Показать статус
echo ""
echo "📊 Статус PM2:"
pm2 status

echo ""
echo "✅ Установка завершена!"
echo ""
echo "📋 Полезные команды:"
echo "  - Посмотреть логи: pm2 logs luxon-bot-1xbet"
echo "  - Перезапустить: pm2 restart luxon-bot-1xbet"
echo "  - Остановить: pm2 stop luxon-bot-1xbet"
echo "  - Статус: pm2 status"

