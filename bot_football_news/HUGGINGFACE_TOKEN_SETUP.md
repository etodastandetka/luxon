# Настройка токена Hugging Face для генерации изображений

## Проблема
Токен возвращает ошибку 403: "This authentication method does not have sufficient permissions to call Inference Providers"

## Решение

### 1. В разделе "User permissions" (права пользователя)

Включите следующие права в секции **Inference**:

✅ **Make calls to Inference Providers** - **ОБЯЗАТЕЛЬНО!**
- Это основное право для использования Router API и генерации изображений
- Без этого права токен не может вызывать Inference Providers

✅ **Make calls to your Inference Endpoints** (опционально)
- Нужно только если вы используете собственные Inference Endpoints

❌ **Manage your Inference Endpoints** (не обязательно)
- Нужно только для управления endpoints, не для использования

### 2. Если токен используется от имени организации

В разделе **"Org permissions"** (если применимо):

✅ **Inference** -> **Make calls to Inference Providers on behalf of the selected organizations**
- Включите, если токен должен работать от имени организации

### 3. Шаги по настройке

1. Перейдите на https://huggingface.co/settings/tokens
2. Найдите ваш токен или создайте новый
3. При создании/редактировании токена:
   - В разделе **"User permissions"** -> **"Inference"**
   - ✅ Отметьте **"Make calls to Inference Providers"**
4. Сохраните токен
5. Обновите токен в `config.py` или `.env` файле

### 4. После обновления токена

1. Обновите `HUGGINGFACE_API_KEY` в `config.py`:
   ```python
   HUGGINGFACE_API_KEY = "ваш_новый_токен_с_правами"
   ```

2. Перезапустите бота:
   ```bash
   python bot.py
   ```

### 5. Проверка работы

После обновления токена бот должен успешно генерировать изображения. В логах вы увидите:
```
✅ Изображение сохранено: images/...
```

## Альтернатива

Если не хотите менять права токена, можно:
1. Отключить генерацию изображений: `ENABLE_IMAGE_GENERATION = False` в `config.py`
2. Использовать другой сервис (FusionBrain, Replicate и т.д.)





