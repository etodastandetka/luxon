#!/bin/bash
# Скрипт установки Node.js API для Timeweb PostgreSQL

echo "════════════════════════════════════════════════════"
echo "  УСТАНОВКА NODE.JS API ДЛЯ TIMEWEB POSTGRESQL"
echo "════════════════════════════════════════════════════"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Устанавливаю Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "✅ Node.js установлен"
else
    echo "✅ Node.js уже установлен: $(node --version)"
fi

# Создание директории
echo ""
echo "📁 Создаю директорию для API..."
mkdir -p ~/payment-api
cd ~/payment-api

# Создание package.json
echo ""
echo "📝 Создаю package.json..."
cat > package.json << 'EOF'
{
  "name": "payment-api",
  "version": "1.0.0",
  "description": "API для сохранения платежей в PostgreSQL",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "pm2": "pm2 start server.js --name payment-api"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.0"
  }
}
EOF

echo "✅ package.json создан"

# Установка зависимостей
echo ""
echo "📦 Устанавливаю зависимости..."
npm install

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ Установка завершена!"
echo ""
echo "📋 Дальше:"
echo "1. Скопируй api_server.js в ~/payment-api/server.js"
echo "2. Настрой подключение к Timeweb БД в server.js"
echo "3. Запусти: cd ~/payment-api && node server.js"
echo "4. Или через PM2: npm run pm2"
echo ""
echo "🔍 Проверка: curl http://localhost:3000/health"
echo "════════════════════════════════════════════════════"

