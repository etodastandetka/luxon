# 🚀 Быстрый старт с Hugging Face API

## 1. Получите API токен

1. Зайдите на [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Нажмите **"New Token"**
3. Название: `Football News Bot`
4. Тип: **Read**
5. Скопируйте токен

## 2. Добавьте токен в config.py

Откройте `bot_football_news/config.py` и найдите строку:

```python
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")
```

Замените на:

```python
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "ваш_токен_здесь")
```

## 3. Включите сервисы

В том же файле `config.py` убедитесь, что:

```python
# Для форматирования текста
AI_TEXT_SERVICE = "huggingface"  # или "none" если не нужен AI

# Для генерации изображений
AI_IMAGE_SERVICE = "huggingface"  # или "none" если не нужны изображения
ENABLE_IMAGE_GENERATION = True
```

## 4. Запустите бота

```bash
python bot.py
```

## ✅ Готово!

Бот будет:
- ✅ Форматировать новости через Hugging Face AI
- ✅ Генерировать изображения для каждой новости
- ✅ Публиковать в канал в формате статей

## 📝 Пример токена

Токен выглядит примерно так:
```
hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Важно**: Не публикуйте токен в открытом доступе!

## 🔧 Если что-то не работает

1. Проверьте, что токен скопирован полностью
2. Убедитесь, что токен имеет тип "Read"
3. Проверьте логи бота - там будут сообщения об ошибках
4. Если модель не загружена, бот подождет автоматически







