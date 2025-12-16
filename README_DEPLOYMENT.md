# 🚀 Развертывание на новом сервере

## 📋 Что было сделано

✅ Созданы скрипты и инструкции для развертывания на новом сервере  
✅ Обновлены все упоминания старых доменов на новые  
✅ Созданы конфигурации Nginx для обоих доменов  
✅ Созданы примеры .env файлов  

## 🌐 Новые домены

- **japar.click** - Админ-панель (Next.js, порт 3001)
- **luxon.dad** - Клиентский сайт (Next.js Mini App, порт 3030)

## 📁 Созданные файлы

### Инструкции
- `DEPLOYMENT_GUIDE.md` - Подробная инструкция по развертыванию
- `QUICK_DEPLOY.md` - Быстрая инструкция (TL;DR)
- `README_DEPLOYMENT.md` - Этот файл

### Скрипты
- `deploy.sh` - Автоматический скрипт развертывания
- `update-domains.sh` - Скрипт для обновления доменов в коде

### Конфигурации
- `nginx-configs/japar.click.conf` - Nginx конфигурация для админки
- `nginx-configs/luxon.dad.conf` - Nginx конфигурация для клиентского сайта

### Примеры .env
- `admin_nextjs/.env.example` - Пример .env для админки
- `bot2/mini_app_site/.env.example` - Пример .env для клиентского сайта

## 🎯 Быстрый старт

### 1. На сервере выполните:

```bash
# Клонирование репозитория
cd /var/www
sudo mkdir -p luxon
sudo chown -R $USER:$USER luxon
cd luxon
git clone <ваш-репозиторий> .

# Создание .env файлов (скопируйте из примеров и заполните)
cp admin_nextjs/.env.example admin_nextjs/.env
cp bot2/mini_app_site/.env.example bot2/mini_app_site/.env
nano admin_nextjs/.env  # Заполните данные
nano bot2/mini_app_site/.env  # Заполните данные

# Автоматическое развертывание
chmod +x deploy.sh
./deploy.sh
```

### 2. Настройка Nginx:

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

### 3. Получение SSL сертификатов:

```bash
# Для админки
sudo certbot --nginx -d japar.click -d www.japar.click

# Для клиентского сайта
sudo certbot --nginx -d luxon.dad -d www.luxon.dad
```

## ✅ Обновленные файлы

Все упоминания `xendro.pro` заменены на `japar.click`:

- ✅ `admin_nextjs/app/api/payment/route.ts`
- ✅ `bot2/mini_app_site/config/api.js`
- ✅ `bot2/mini_app_site/utils/fetch.ts`
- ✅ `bot_simple/bot.py`
- ✅ `bot_1xbet/bot.py`
- ✅ `req/app/src/main/java/com/req/notificationreader/util/DatabaseConfig.kt`
- ✅ `req/api_server.js`
- ✅ `admin_nextjs/VIDEO_INSTRUCTIONS_SETUP.md`

## 📝 Важные замечания

1. **Домены должны указывать на IP сервера** (A-записи) перед получением SSL
2. **Порты 80 и 443 должны быть открыты** в firewall
3. **Используйте сильные пароли** для базы данных и JWT_SECRET
4. **Создайте первого администратора** после развертывания:
   ```bash
   cd /var/www/luxon/admin_nextjs
   ADMIN_USERNAME=admin ADMIN_PASSWORD=ваш_пароль ADMIN_EMAIL=admin@luxon.com npm run create-admin
   ```

## 🔧 Полезные команды

```bash
# Статус процессов
pm2 status
pm2 logs

# Перезапуск
pm2 restart all

# Обновление кода
cd /var/www/luxon
git pull origin main
cd admin_nextjs && npm install && npm run build && pm2 restart luxon-admin
cd ../bot2/mini_app_site && npm install && npm run build && pm2 restart luxon-mini-app
```

## 📚 Дополнительная документация

- Подробная инструкция: `DEPLOYMENT_GUIDE.md`
- Быстрая инструкция: `QUICK_DEPLOY.md`

## 🆘 Проблемы?

1. Проверьте логи: `pm2 logs`
2. Проверьте Nginx: `sudo nginx -t`
3. Проверьте порты: `sudo netstat -tlnp | grep -E '3001|3030'`
4. Проверьте SSL: `sudo certbot certificates`

