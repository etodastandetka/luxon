# Диагностика и исправление проблем с ботом

## Быстрая диагностика

Выполните на сервере:

```bash
cd /var/www/luxon/bot
bash check_bot.sh
```

## Ручная проверка

### 1. Проверка статуса PM2

```bash
pm2 status
pm2 list
```

Должны быть запущены:
- `luxon-bot` (основной бот)
- `operator_bot` (бот оператора)

### 2. Проверка логов

```bash
# Логи основного бота
pm2 logs luxon-bot --lines 50

# Логи ошибок
pm2 logs luxon-bot --err --lines 50

# Логи операторского бота
pm2 logs operator_bot --lines 50
```

### 3. Проверка виртуального окружения

```bash
cd /var/www/luxon/bot

# Проверка существования
ls -la venv/

# Активация и проверка Python
source venv/bin/activate
python --version
which python
```

### 4. Проверка зависимостей

```bash
cd /var/www/luxon/bot
source venv/bin/activate

# Установка/обновление зависимостей
pip install -r requirements.txt

# Проверка установленных пакетов
pip list | grep telegram
```

### 5. Проверка токена

```bash
cd /var/www/luxon/bot

# Проверка токена в bot.py
grep "BOT_TOKEN" bot.py

# Должен быть: 7927891546:AAHyroAGoOIV6qKFAnZur13i8gvw2hMnJ-4
```

### 6. Тест запуска бота

```bash
cd /var/www/luxon/bot
source venv/bin/activate

# Тест импортов
python -c "from security import rate_limit_decorator; print('OK')"
python -c "from telegram import Update; print('OK')"

# Тест синтаксиса
python -m py_compile bot.py
```

## Исправление проблем

### Проблема: Бот не запускается

1. **Остановите все процессы:**
```bash
pm2 stop all
pm2 delete all
```

2. **Проверьте и исправьте виртуальное окружение:**
```bash
cd /var/www/luxon/bot
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

3. **Проверьте файлы:**
```bash
ls -la bot.py security.py requirements.txt
```

4. **Запустите заново:**
```bash
pm2 start ecosystem.config.js
pm2 save
```

### Проблема: Ошибки импорта

```bash
cd /var/www/luxon/bot
source venv/bin/activate

# Переустановка зависимостей
pip uninstall python-telegram-bot httpx -y
pip install python-telegram-bot==20.7 httpx~=0.25.2
```

### Проблема: Бот падает с ошибками

1. **Проверьте логи:**
```bash
pm2 logs luxon-bot --err --lines 100
```

2. **Проверьте права доступа:**
```bash
cd /var/www/luxon/bot
ls -la bot.py security.py
chmod +x bot.py
```

3. **Проверьте токен:**
```bash
# Убедитесь, что токен правильный в bot.py
grep "BOT_TOKEN" bot.py
```

### Проблема: Бот не отвечает

1. **Проверьте, что бот запущен:**
```bash
pm2 status
pm2 restart luxon-bot
```

2. **Проверьте подключение к Telegram:**
```bash
# Тест токена через API
curl "https://api.telegram.org/bot7927891546:AAHyroAGoOIV6qKFAnZur13i8gvw2hMnJ-4/getMe"
```

3. **Проверьте интернет-соединение:**
```bash
ping api.telegram.org
```

## Полный перезапуск

```bash
# 1. Остановка
pm2 stop all
pm2 delete all

# 2. Обновление кода (если нужно)
cd /var/www/luxon
git pull origin main

# 3. Настройка окружения
cd /var/www/luxon/bot
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 4. Запуск
pm2 start ecosystem.config.js
pm2 save

# 5. Проверка
pm2 status
pm2 logs luxon-bot --lines 20
```

## Полезные команды PM2

```bash
# Статус всех процессов
pm2 status

# Логи в реальном времени
pm2 logs

# Логи конкретного бота
pm2 logs luxon-bot

# Перезапуск
pm2 restart luxon-bot

# Остановка
pm2 stop luxon-bot

# Удаление
pm2 delete luxon-bot

# Мониторинг
pm2 monit

# Сохранение конфигурации
pm2 save

# Автозапуск при перезагрузке
pm2 startup
```

## Контакты для помощи

Если проблема не решена, соберите информацию:

```bash
# Соберите диагностическую информацию
cd /var/www/luxon/bot
bash check_bot.sh > bot_diagnosis.txt 2>&1
pm2 logs luxon-bot --lines 100 > bot_logs.txt 2>&1
pm2 describe luxon-bot > pm2_info.txt 2>&1
```

Отправьте файлы: `bot_diagnosis.txt`, `bot_logs.txt`, `pm2_info.txt`

