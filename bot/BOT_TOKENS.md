# Токены ботов LUXON

## Основной бот (luxon-bot / bot)
- **Файл**: `bot/bot.py`
- **Токен**: `7927891546:AAHyroAGoOIV6qKFAnZur13i8gvw2hMnJ-4`
- **PM2 процесс**: `bot` или `luxon-bot`
- **Проверка**: Токен должен начинаться с `7927891546`

## Бот 1xbet
- **Файл**: `bot_1xbet/bot.py`
- **Токен**: `8042108386:AAFGNVTTfrMy-KwHjxOA72Gd_iV-Bgy5u4U`
- **PM2 процесс**: `luxon-bot-1xbet`
- **Проверка**: Токен должен начинаться с `8042108386`

## Бот оператора (support_bot)
- **Файл**: `bot/support_bot.py`
- **Токен**: `8390085986:AAH9iS53RgIleXC-JfExWv8SxwvJR1rPdbI`
- **PM2 процесс**: `operator_bot`
- **Проверка**: Токен должен начинаться с `8390085986`

## Проверка токенов на сервере

```bash
# Проверить токен в bot/bot.py
grep "BOT_TOKEN" /var/www/luxon/bot/bot.py

# Проверить токен в bot_1xbet/bot.py
grep "BOT_TOKEN" /var/www/luxon/bot_1xbet/bot.py

# Проверить токен в support_bot.py
grep "SUPPORT_BOT_TOKEN" /var/www/luxon/bot/support_bot.py

# Проверить, какой процесс PM2 запущен и какой файл использует
pm2 list
pm2 describe bot
pm2 describe luxon-bot-1xbet
pm2 describe operator_bot
```

## Если токены перепутались

1. Остановите все боты:
```bash
pm2 stop all
```

2. Проверьте токены в файлах:
```bash
cd /var/www/luxon
grep -r "BOT_TOKEN\|SUPPORT_BOT_TOKEN" bot/*.py bot_1xbet/*.py
```

3. Убедитесь, что каждый файл использует правильный токен согласно таблице выше

4. Перезапустите боты:
```bash
pm2 restart all
```

