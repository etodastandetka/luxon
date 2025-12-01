#!/bin/bash

# Скрипт автоматического развертывания на новом сервере
# Использование: ./deploy.sh

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Начало развертывания Luxon на новом сервере${NC}\n"

# Проверка прав root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Не запускайте скрипт от root! Используйте обычного пользователя с sudo правами.${NC}"
   exit 1
fi

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    echo "Установите Node.js: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
fi

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен!${NC}"
    exit 1
fi

# Проверка PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 не установлен. Устанавливаю...${NC}"
    sudo npm install -g pm2
fi

# Проверка PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL не установлен. Установите: sudo apt install postgresql postgresql-contrib${NC}"
    exit 1
fi

# Создание директорий
echo -e "\n${BLUE}📁 Создание директорий...${NC}"
sudo mkdir -p /var/www/luxon
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/www/luxon
sudo chown -R $USER:$USER /var/log/pm2

# Переход в директорию проекта
cd /var/www/luxon

# Проверка существования .env файлов
echo -e "\n${BLUE}🔍 Проверка .env файлов...${NC}"

if [ ! -f "admin_nextjs/.env" ]; then
    echo -e "${YELLOW}⚠️  admin_nextjs/.env не найден!${NC}"
    echo "Создайте файл admin_nextjs/.env на основе DEPLOYMENT_GUIDE.md"
    exit 1
fi

if [ ! -f "bot2/mini_app_site/.env" ]; then
    echo -e "${YELLOW}⚠️  bot2/mini_app_site/.env не найден!${NC}"
    echo "Создайте файл bot2/mini_app_site/.env на основе DEPLOYMENT_GUIDE.md"
    exit 1
fi

# Установка зависимостей админки
echo -e "\n${BLUE}📦 Установка зависимостей админки...${NC}"
cd /var/www/luxon/admin_nextjs
if [ ! -d "node_modules" ]; then
    npm install
else
    npm install
fi

# Генерация Prisma Client
echo -e "\n${BLUE}🔧 Генерация Prisma Client...${NC}"
npm run db:generate

# Применение схемы базы данных
echo -e "\n${BLUE}🗄️  Применение схемы базы данных...${NC}"
npm run db:push || echo -e "${YELLOW}⚠️  db:push завершился с ошибкой (возможно, схема уже применена)${NC}"

# Сборка админки
echo -e "\n${BLUE}🏗️  Сборка админки...${NC}"
npm run build

# Установка зависимостей клиентского сайта
echo -e "\n${BLUE}📦 Установка зависимостей клиентского сайта...${NC}"
cd /var/www/luxon/bot2/mini_app_site
if [ ! -d "node_modules" ]; then
    npm install
else
    npm install
fi

# Сборка клиентского сайта
echo -e "\n${BLUE}🏗️  Сборка клиентского сайта...${NC}"
npm run build

# Обновление доменов в коде
echo -e "\n${BLUE}🔄 Обновление доменов в коде...${NC}"
cd /var/www/luxon
if [ -f "update-domains.sh" ]; then
    chmod +x update-domains.sh
    ./update-domains.sh
else
    echo -e "${YELLOW}⚠️  Скрипт update-domains.sh не найден, пропускаю обновление доменов${NC}"
fi

# Запуск через PM2
echo -e "\n${BLUE}🚀 Запуск приложений через PM2...${NC}"

# Остановка существующих процессов (если есть)
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Запуск админки
cd /var/www/luxon/admin_nextjs
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
else
    echo -e "${YELLOW}⚠️  ecosystem.config.js не найден, создаю базовую конфигурацию...${NC}"
    pm2 start npm --name "luxon-admin" -- start
fi

# Запуск клиентского сайта
cd /var/www/luxon/bot2/mini_app_site
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
else
    echo -e "${YELLOW}⚠️  ecosystem.config.js не найден, создаю базовую конфигурацию...${NC}"
    pm2 start npm --name "luxon-mini-app" -- run start:prod
fi

# Сохранение конфигурации PM2
pm2 save

# Настройка автозапуска
echo -e "\n${BLUE}⚙️  Настройка автозапуска PM2...${NC}"
pm2 startup | grep -v "PM2" | sudo bash || echo -e "${YELLOW}⚠️  Автозапуск уже настроен${NC}"

# Вывод статуса
echo -e "\n${GREEN}✅ Развертывание завершено!${NC}\n"
echo -e "${BLUE}📊 Статус процессов:${NC}"
pm2 status

echo -e "\n${BLUE}📝 Полезные команды:${NC}"
echo "  pm2 logs              - Просмотр логов"
echo "  pm2 restart all       - Перезапуск всех процессов"
echo "  pm2 monit             - Мониторинг процессов"
echo ""
echo -e "${YELLOW}⚠️  Не забудьте:${NC}"
echo "  1. Настроить Nginx конфигурации (см. DEPLOYMENT_GUIDE.md)"
echo "  2. Получить SSL сертификаты: sudo certbot --nginx -d japar.click -d luxon.dad"
echo "  3. Проверить работу сайтов: https://japar.click и https://luxon.dad"

