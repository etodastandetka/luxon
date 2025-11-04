# Команды для обновления бота на сервере

## Быстрый способ (используя скрипт):

```bash
cd /var/www/luxon
chmod +x UPDATE_BOT_REFERRAL.sh
./UPDATE_BOT_REFERRAL.sh
```

## Ручной способ (пошагово):

### 1. Обновить код из Git:
```bash
cd /var/www/luxon
git pull origin main
```

### 2. Установить httpx в виртуальное окружение Django admin:
```bash
cd /var/www/luxon/django_admin
source venv/bin/activate
pip install httpx==0.27.0
deactivate
cd /var/www/luxon
```

### 3. Перезапустить бота:
```bash
pm2 restart luxon-bot
```

### 4. Проверить статус:
```bash
pm2 status luxon-bot
pm2 logs luxon-bot --lines 50
```

## Проверка работы:

1. Отправьте боту команду `/start ref123456` (где 123456 - ID существующего пользователя)
2. Проверьте логи бота на наличие сообщения "✅ Реферальная связь зарегистрирована"
3. Отправьте команду `/referral` - должна показаться статистика реферальной программы

## Если бот не запускается:

1. Проверьте, что httpx установлен:
```bash
cd /var/www/luxon/django_admin
source venv/bin/activate
pip list | grep httpx
```

2. Если httpx не установлен, установите вручную:
```bash
pip install httpx==0.27.0
```

3. Проверьте логи ошибок:
```bash
pm2 logs luxon-bot --err --lines 100
```

4. Убедитесь, что используется правильный Python интерпретатор:
```bash
cat ecosystem.config.js | grep luxon-bot -A 10
```
Должен быть путь к `/var/www/luxon/django_admin/venv/bin/python3`

