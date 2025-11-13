# Документация Hugging Face для генерации изображений

## Какая документация нужна

Для генерации изображений через Hugging Face нужна документация по:

### 1. **Inference Providers** (основная)
- **Ссылка**: https://huggingface.co/docs/api-inference
- **Что это**: Документация по вызову 200k+ моделей через партнеров Hugging Face
- **Зачем**: Здесь описано, как использовать модели для генерации изображений через API
- **Ключевые разделы**:
  - Text-to-image generation
  - API endpoints
  - Authentication
  - Model parameters

### 2. **Hub Python Library** (альтернатива)
- **Ссылка**: https://huggingface.co/docs/huggingface_hub
- **Что это**: Python библиотека для работы с Hugging Face Hub
- **Зачем**: Можно использовать `InferenceClient` для генерации изображений
- **Пример**:
  ```python
  from huggingface_hub import InferenceClient
  client = InferenceClient(token="your_token")
  image = client.text_to_image(prompt="your prompt", model="model_name")
  ```

### 3. **Inference Endpoints** (для деплоя собственных моделей)
- **Ссылка**: https://huggingface.co/docs/inference-endpoints
- **Что это**: Документация по деплою моделей на выделенной инфраструктуре
- **Зачем**: Если хотите развернуть свою модель (не обязательно для начала)

## Рекомендуемый порядок изучения

1. **Начните с Inference Providers**:
   - Изучите формат запросов для text-to-image
   - Узнайте правильные endpoints
   - Проверьте требования к токенам

2. **Проверьте примеры кода**:
   - Посмотрите примеры использования API
   - Изучите формат ответов

3. **Если не работает через API, попробуйте Hub Library**:
   - Используйте `huggingface_hub` библиотеку
   - Может быть проще в использовании

## Полезные ссылки

- **Inference API документация**: https://huggingface.co/docs/api-inference
- **Inference Providers**: https://huggingface.co/docs/api-inference/detailed_parameters#text-to-image-task
- **Hub Python Library**: https://huggingface.co/docs/huggingface_hub/package_reference/inference_client
- **Примеры кода**: https://huggingface.co/docs/api-inference/quicktour

## Текущая проблема

Мы используем Router API, но получаем ошибки 403/404. Нужно:
1. Проверить правильный формат запросов в документации Inference Providers
2. Убедиться, что токен имеет права "Make calls to Inference Providers"
3. Возможно, использовать другой endpoint или формат запроса






