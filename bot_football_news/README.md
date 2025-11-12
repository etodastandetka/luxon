# Бот для футбольных новостей LUXON

Telegram-бот для автоматической публикации футбольных новостей в канал LUXON с AI-форматированием и генерацией изображений.

## Возможности

- 📰 Автоматический парсинг новостей из RSS-лент (Sports.ru, Championat.com)
- 🤖 AI-форматирование новостей с прогнозами
- 🎨 Генерация изображений для новостей
- ⏰ Автоматическая публикация по расписанию
- 📝 Красивое форматирование с эмодзи и HTML

## Установка

1. Установите зависимости:
```bash
pip install -r requirements.txt
```

2. Скопируйте `.env.example` в `.env` и заполните настройки:
```bash
cp .env.example .env
```

3. Настройте переменные окружения в `.env`:
   - `TELEGRAM_BOT_TOKEN` - токен вашего Telegram бота (получите у @BotFather)
   - `TELEGRAM_CHANNEL_ID` - ID или username канала (например, `@luxon` или `-1001234567890`)
   - Настройте AI сервисы (см. ниже)

## Настройка AI сервисов

### Для форматирования текста (AI_TEXT_SERVICE)

#### 1. Hugging Face (рекомендуется, бесплатно)
1. Зарегистрируйтесь на [Hugging Face](https://huggingface.co/)
2. Создайте API токен в настройках
3. Установите в `.env`:
   ```
   AI_TEXT_SERVICE=huggingface
   HUGGINGFACE_API_KEY=your_token_here
   ```

#### 2. GigaChat (бесплатно, требуется регистрация)
1. Зарегистрируйтесь на [GigaChat](https://developers.sber.ru/gigachat)
2. Получите Client ID и Secret
3. Установите в `.env`:
   ```
   AI_TEXT_SERVICE=gigachat
   GIGACHAT_CLIENT_ID=your_id
   GIGACHAT_CLIENT_SECRET=your_secret
   ```

#### 3. YandexGPT (бесплатный tier)
1. Создайте сервисный аккаунт в Yandex Cloud
2. Получите API ключ и Folder ID
3. Установите в `.env`:
   ```
   AI_TEXT_SERVICE=yandexgpt
   YANDEX_API_KEY=your_key
   YANDEX_FOLDER_ID=your_folder_id
   ```

#### 4. Ollama (локально, полностью бесплатно)
1. Установите [Ollama](https://ollama.ai/)
2. Скачайте модель: `ollama pull llama2`
3. Установите в `.env`:
   ```
   AI_TEXT_SERVICE=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   ```

#### 5. Без AI (простое форматирование)
```
AI_TEXT_SERVICE=none
```

### Для генерации изображений (AI_IMAGE_SERVICE)

#### 1. Hugging Face (бесплатно)
```
AI_IMAGE_SERVICE=huggingface
HUGGINGFACE_API_KEY=your_token_here
```

#### 2. FusionBrain (Kandinsky, бесплатно)
1. Зарегистрируйтесь на [FusionBrain](https://fusionbrain.ai/)
2. Получите API ключи
3. Установите в `.env`:
   ```
   AI_IMAGE_SERVICE=fusionbrain
   FUSIONBRAIN_API_KEY=your_key
   FUSIONBRAIN_SECRET_KEY=your_secret
   ```

#### 3. Replicate (бесплатный tier)
1. Зарегистрируйтесь на [Replicate](https://replicate.com/)
2. Получите API токен
3. Установите в `.env`:
   ```
   AI_IMAGE_SERVICE=replicate
   REPLICATE_API_TOKEN=your_token
   ```

#### 4. Без генерации изображений
```
AI_IMAGE_SERVICE=none
ENABLE_IMAGE_GENERATION=false
```

## Запуск

### Обычный запуск (с планировщиком)
```bash
python bot.py
```

Бот будет автоматически публиковать новости по расписанию, указанному в `config.py`.

### Тестовая публикация
Для тестирования можно добавить в `bot.py` вызов `await bot.test_publish()` в функции `run()`.

## Настройка расписания

В файле `config.py` можно настроить:
- `PUBLISH_TIMES` - список времени публикации (например, `["09:00", "15:00", "21:00"]`)
- `PUBLISH_INTERVAL_HOURS` - интервал публикации в часах

## Структура проекта

```
bot_football_news/
├── bot.py              # Основной файл бота
├── news_parser.py      # Парсинг новостей из RSS
├── ai_formatter.py     # AI форматирование текста
├── image_generator.py  # Генерация изображений
├── scheduler.py        # Планировщик публикаций
├── config.py           # Конфигурация
├── requirements.txt    # Зависимости
├── .env               # Переменные окружения (создайте из .env.example)
├── news_history.json  # История опубликованных новостей (создается автоматически)
└── images/            # Сгенерированные изображения
```

## Источники новостей

По умолчанию используются:
- Sports.ru: `https://www.sports.ru/rss/football.xml`
- Championat.com: `https://www.championat.com/rss/football/`

Можно добавить дополнительные источники в `config.py` в список `NEWS_SOURCES`.

## Формат сообщений

Бот публикует новости в следующем формате:
- Заголовок (жирный, с эмодзи)
- Краткое описание
- Основной текст с цитатами
- Прогноз или анализ
- Хештеги
- Ссылка на источник
- Изображение (если включено)

## Логирование

Все операции логируются. Логи выводятся в консоль с уровнем INFO.

## Обработка ошибок

- Бот автоматически обрабатывает ошибки API
- При недоступности AI сервиса используется простое форматирование
- Дубликаты новостей автоматически фильтруются
- История публикаций сохраняется в `news_history.json`

## Примечания

- Для работы с каналом бот должен быть добавлен как администратор
- Некоторые AI сервисы имеют ограничения по количеству запросов
- Генерация изображений может занимать время (до 60 секунд)
- Рекомендуется запускать бота на сервере с постоянным подключением

## Поддержка

При возникновении проблем проверьте:
1. Правильность токенов и API ключей
2. Права бота в канале
3. Доступность источников новостей
4. Логи в консоли






