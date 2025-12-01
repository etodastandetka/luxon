# Быстрое развертывание на новом сервере

## Быстрая инструкция (TL;DR)

### 1. Подготовка сервера (выполнить один раз)

```bash
# Обновление и установка пакетов
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx postgresql postgresql-contrib certbot python3-certbot-nginx

# Установка Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PM2
sudo npm install -g pm2
```

### 2. Настройка базы данных

```bash
sudo -u postgres psql
```

В PostgreSQL:
```sql
CREATE DATABASE luxon_admin;
CREATE USER luxon_user WITH ENCRYPTED PASSWORD 'ваш_надежный_пароль';
GRANT ALL PRIVILEGES ON DATABASE luxon_admin TO luxon_user;
\q
```

### 3. Клонирование и настройка проекта

```bash
# Создание директории
sudo mkdir -p /var/www/luxon
sudo chown -R $USER:$USER /var/www/luxon

# Клонирование (замените на ваш репозиторий)
cd /var/www/luxon
git clone <ваш-git-репозиторий> .

# Или если уже есть репозиторий
git pull origin main
```

### 4. Создание .env файлов

**Админка** (`admin_nextjs/.env`):
```env
DATABASE_URL="postgresql://luxon_user:ваш_пароль@localhost:5432/luxon_admin?schema=public"
JWT_SECRET="сгенерируйте_случайную_строку_минимум_32_символа"
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://japar.click"
BOT_TOKEN="ваш_бот_токен"
```

**Клиентский сайт** (`bot2/mini_app_site/.env`):
```env
NODE_ENV="production"
ADMIN_API_URL="http://127.0.0.1:3001"
NEXT_PUBLIC_DJANGO_API_URL="https://japar.click"
```

### 5. Автоматическое развертывание

```bash
cd /var/www/luxon
chmod +x deploy.sh
./deploy.sh
```

### 6. Настройка Nginx

```bash
# Копирование конфигураций
sudo cp nginx-configs/japar.click.conf /etc/nginx/sites-available/japar.click
sudo cp nginx-configs/luxon.dad.conf /etc/nginx/sites-available/luxon.dad

# Активация
sudo ln -s /etc/nginx/sites-available/japar.click /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/luxon.dad /etc/nginx/sites-enabled/

# Проверка и перезагрузка
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Получение SSL сертификатов

```bash
# Для админки
sudo certbot --nginx -d japar.click -d www.japar.click

# Для клиентского сайта
sudo certbot --nginx -d luxon.dad -d www.luxon.dad
```

### 8. Обновление доменов в коде

```bash
cd /var/www/luxon
chmod +x update-domains.sh
./update-domains.sh
```

### 9. Перезапуск приложений

```bash
pm2 restart all
```

## Проверка работы

- Админка: https://japar.click
- Клиентский сайт: https://luxon.dad
- Логи: `pm2 logs`
- Статус: `pm2 status`

## Важные замечания

1. **Домены должны указывать на IP сервера** (A-записи) перед получением SSL
2. **Порты 80 и 443 должны быть открыты** в firewall
3. **Используйте сильные пароли** для базы данных и JWT_SECRET
4. **Регулярно обновляйте систему**: `sudo apt update && sudo apt upgrade -y`

## Проблемы?

Смотрите подробную инструкцию в `DEPLOYMENT_GUIDE.md`

