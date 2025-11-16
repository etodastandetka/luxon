# Проверка запуска operator_bot

## Если бот не появился в `pm2 list`:

### 1. Проверьте логи ошибок

```bash
pm2 logs operator_bot --err --lines 50
```

Или напрямую:
```bash
tail -50 /var/log/pm2/operator_bot-error.log
cat /var/log/pm2/operator_bot-error.log
```

### 2. Проверьте, что файл существует

```bash
cd /var/www/luxon/bot_simple
ls -la support_bot.py
```

### 3. Проверьте, что виртуальное окружение существует

```bash
ls -la venv/bin/python
```

### 4. Попробуйте запустить напрямую (для диагностики)

```bash
cd /var/www/luxon/bot_simple
source venv/bin/activate
export SUPPORT_BOT_TOKEN="8390085986:AAH9iS53RgIleXC-JfExWv8SxwvJR1rPdbI"
python support_bot.py
```

Если запускается напрямую, но не через PM2 - проблема в конфигурации PM2.

### 5. Проверьте конфигурацию PM2

```bash
cd /var/www/luxon/bot_simple
pm2 describe operator_bot
```

### 6. Попробуйте запустить с явным указанием всех параметров

```bash
cd /var/www/luxon/bot_simple
pm2 start venv/bin/python --name operator_bot --interpreter none -- support_bot.py --env SUPPORT_BOT_TOKEN="8390085986:AAH9iS53RgIleXC-JfExWv8SxwvJR1rPdbI"
```

### 7. Альтернативный способ - через скрипт-обертку

Создайте файл `start_operator_bot.sh`:

```bash
#!/bin/bash
cd /var/www/luxon/bot_simple
source venv/bin/activate
export SUPPORT_BOT_TOKEN="8390085986:AAH9iS53RgIleXC-JfExWv8SxwvJR1rPdbI"
python support_bot.py
```

Сделайте его исполняемым:
```bash
chmod +x start_operator_bot.sh
```

И запустите через PM2:
```bash
pm2 start start_operator_bot.sh --name operator_bot
```

### 8. Проверьте права доступа

```bash
chmod +x support_bot.py
chmod +x venv/bin/python
```

## Частые ошибки:

### "No such file or directory"
- Проверьте пути в `ecosystem.config.js`
- Убедитесь, что `cwd` правильный: `/var/www/luxon/bot_simple`

### "Module not found"
- Активируйте venv и установите зависимости:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### "Invalid token"
- Проверьте токен в коде или переменной окружения
- Убедитесь, что токен правильный (получите у @BotFather)

### Бот запускается, но сразу падает
- Проверьте логи: `pm2 logs operator_bot`
- Проверьте, нет ли конфликта с другим экземпляром

