# 🔑 Как получить API ключ Hugging Face

## Шаг 1: Регистрация на Hugging Face

1. Перейдите на [https://huggingface.co/](https://huggingface.co/)
2. Нажмите **"Sign Up"** (Регистрация)
3. Создайте учетную запись (можно через GitHub, Google или email)

## Шаг 2: Получение API токена

1. **Войдите в свой аккаунт** на Hugging Face
2. Нажмите на **иконку профиля** (правый верхний угол)
3. Выберите **"Settings"** (Настройки)
4. В левом меню выберите **"Access Tokens"** (Токены доступа)
5. Нажмите **"New Token"** (Новый токен)
6. Укажите:
   - **Name** (Имя): например, "Football News Bot"
   - **Type**: выберите **"Read"** (для Inference API достаточно прав на чтение)
7. Нажмите **"Generate Token"** (Сгенерировать токен)
8. **Скопируйте токен** - он показывается только один раз!

## Шаг 3: Добавление токена в бота

### Вариант 1: Через файл config.py

Откройте `bot_football_news/config.py` и добавьте:

```python
HUGGINGFACE_API_KEY = "ваш_токен_здесь"
```

### Вариант 2: Через переменные окружения (рекомендуется)

Создайте файл `.env` в папке `bot_football_news/`:

```env
HUGGINGFACE_API_KEY=ваш_токен_здесь
```

## Шаг 4: Настройка сервисов

В `config.py` укажите, какие сервисы использовать:

```python
# Для форматирования текста
AI_TEXT_SERVICE = "huggingface"
HUGGINGFACE_MODEL = "mistralai/Mistral-7B-Instruct-v0.2"  # или другая модель

# Для генерации изображений
AI_IMAGE_SERVICE = "huggingface"
ENABLE_IMAGE_GENERATION = True
```

## 🔗 Полезные ссылки

- [Hugging Face Settings](https://huggingface.co/settings/tokens) - прямое создание токена
- [Hugging Face Inference API Docs](https://huggingface.co/docs/api-inference/index) - документация API
- [Inference Providers](https://huggingface.co/inference-providers) - информация о провайдерах

## 💡 Примечания

- **Бесплатный tier**: Hugging Face предоставляет бесплатные запросы (ограниченное количество)
- **Безопасность**: Никогда не публикуйте токен в открытом доступе (GitHub, форумы и т.д.)
- **Обновление токена**: Если токен скомпрометирован, удалите его и создайте новый

## ✅ Проверка работы

После добавления токена запустите бота:

```bash
python bot.py
```

Если токен правильный, бот будет использовать Hugging Face API для форматирования текста и генерации изображений.







