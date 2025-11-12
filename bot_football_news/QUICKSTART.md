# Быстрый старт

## 1. Установка зависимостей

```bash
pip install -r requirements.txt
```

## 2. Настройка

Создайте файл `.env` в папке `bot_football_news/`:

```env
TELEGRAM_BOT_TOKEN=ваш_токен_бота
TELEGRAM_CHANNEL_ID=@luxon
AI_TEXT_SERVICE=none
AI_IMAGE_SERVICE=none
ENABLE_IMAGE_GENERATION=false
```

**Как получить токен бота:**
1. Найдите @BotFather в Telegram
2. Отправьте `/newbot` и следуйте инструкциям
3. Скопируйте полученный токен

**Как получить ID канала:**
- Если канал публичный: используйте `@channel_username`
- Если канал приватный: используйте ID вида `-1001234567890` (можно получить через @userinfobot)

**Важно:** Бот должен быть администратором канала!

## 3. Запуск

### Простой запуск (без AI, только парсинг)

```bash
python bot.py
```

Бот будет публиковать новости каждые 6 часов автоматически.

### С AI форматированием

1. Зарегистрируйтесь на [Hugging Face](https://huggingface.co/)
2. Создайте API токен в настройках
3. Добавьте в `.env`:
   ```env
   AI_TEXT_SERVICE=huggingface
   HUGGINGFACE_API_KEY=ваш_токен
   ```

### С генерацией изображений

Добавьте в `.env`:
```env
AI_IMAGE_SERVICE=huggingface
HUGGINGFACE_API_KEY=ваш_токен
ENABLE_IMAGE_GENERATION=true
```

## 4. Настройка расписания

В файле `config.py` можно изменить:
- `PUBLISH_TIMES` - время публикации (например, `["09:00", "15:00", "21:00"]`)
- `PUBLISH_INTERVAL_HOURS` - интервал в часах

## Тестирование

Для тестовой публикации можно временно раскомментировать в `bot.py`:
```python
# await self.publish_news()  # в функции run()
```

## Проблемы?

- Проверьте, что бот добавлен как администратор канала
- Проверьте правильность токенов в `.env`
- Смотрите логи в консоли для диагностики






