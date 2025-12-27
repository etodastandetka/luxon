# Environment Variables

This document describes all environment variables used in the football news bot.

## Required Variables

### Telegram Configuration

- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_CHANNEL_ID` - Telegram channel ID for posting news

### API Keys

- `ALLSPORTSAPI_KEY` - AllSportsAPI key for football data
- `HUGGINGFACE_API_KEY` - Hugging Face API key for text formatting
- `HUGGINGFACE_MODEL` - Hugging Face model name (default: `mistralai/Mistral-7B-Instruct-v0.2`)

## Optional Variables

### AI Services

- `AI_TEXT_SERVICE` - AI service for text formatting (`huggingface`, `gigachat`, `yandexgpt`, `ollama`, `none`)
- `AI_IMAGE_SERVICE` - AI service for image generation (currently forced to `craiyon`)

### GigaChat (if using)

- `GIGACHAT_CLIENT_ID` - GigaChat client ID
- `GIGACHAT_CLIENT_SECRET` - GigaChat client secret
- `GIGACHAT_SCOPE` - GigaChat scope (default: `GIGACHAT_API_PERS`)

### YandexGPT (if using)

- `YANDEX_API_KEY` - Yandex API key
- `YANDEX_FOLDER_ID` - Yandex folder ID

### Ollama (if using)

- `OLLAMA_BASE_URL` - Ollama base URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Ollama model name (default: `llama2`)

### Image Generation

- `HUGGINGFACE_IMAGE_MODEL` - Hugging Face image model (default: `runwayml/stable-diffusion-v1-5`)
- `FUSIONBRAIN_API_KEY` - FusionBrain API key
- `FUSIONBRAIN_SECRET_KEY` - FusionBrain secret key
- `REPLICATE_API_TOKEN` - Replicate API token
- `STABILITYAI_API_KEY` - Stability AI API key

## Example .env file

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=-1003444253148

# AllSportsAPI
ALLSPORTSAPI_KEY=your_api_key_here

# Hugging Face
HUGGINGFACE_API_KEY=your_huggingface_key_here
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2

# AI Service
AI_TEXT_SERVICE=huggingface
```

## Security Note

⚠️ **IMPORTANT**: Never commit `.env` files to version control. The current `config.py` has hardcoded values as fallbacks, but these should be removed in production.


