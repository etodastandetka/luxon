#!/bin/bash
# Скрипт для перезапуска бота

echo "🔄 Перезапуск бота LUXON..."

cd /var/www/luxon/bot_simple

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo "⚠️ Виртуальное окружение не найдено, создаю..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    source venv/bin/activate
    pip install -r requirements.txt
fi

# Остановка существующих процессов
echo "⏹️ Остановка существующих процессов..."
pm2 stop luxon-bot 2>/dev/null || true
pm2 delete luxon-bot 2>/dev/null || true

# Запуск через PM2
echo "▶️ Запуск бота..."
pm2 start ecosystem.config.js --only luxon-bot

# Сохранение конфигурации
pm2 save

# Проверка статуса
echo ""
echo "📊 Статус бота:"
pm2 status luxon-bot

echo ""
echo "📝 Последние логи (5 строк):"
pm2 logs luxon-bot --lines 5 --nostream

echo ""
echo "✅ Готово! Бот перезапущен."
echo "Для просмотра логов в реальном времени: pm2 logs luxon-bot"

