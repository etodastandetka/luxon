"""
Конфигурация бота для футбольных новостей
"""
import os
from dotenv import load_dotenv

# Загружаем .env если он существует (не обязательно)
try:
    load_dotenv()
except Exception:
    pass  # Игнорируем ошибки загрузки .env, используем значения по умолчанию

# Telegram настройки
# Можно задать прямо здесь или через переменные окружения
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "7112771039:AAFwfzffWfPXiDSY8uJZom7wWC-UhWAkVPU")
TELEGRAM_CHANNEL_ID = os.getenv("TELEGRAM_CHANNEL_ID", "-1003444253148")

# AllSportsAPI настройки
ALLSPORTSAPI_KEY = os.getenv("ALLSPORTSAPI_KEY", "b90169c43f23685f67966858de83577fe547c49dbfd9e93a862d825f537c46e4")
ALLSPORTSAPI_BASE_URL = "https://apiv2.allsportsapi.com/football"

# Источники новостей
# Используем AllSportsAPI для получения футбольных данных
USE_ALLSPORTSAPI = True  # Включено с правильным URL из документации

# RSS-источники (резервные, если API недоступен)
NEWS_SOURCES = [
    "https://www.sports.ru/rss/football.xml",  # Sports.ru - футбол
    "https://rssexport.rbc.ru/rbcnews/sport/index.rss",  # РБК Спорт
]

# AI настройки для форматирования текста
# Варианты: "huggingface", "gigachat", "yandexgpt", "ollama", "none"
AI_TEXT_SERVICE = os.getenv("AI_TEXT_SERVICE", "huggingface")  # Включено с Hugging Face токеном

# Hugging Face настройки
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "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")
HUGGINGFACE_MODEL = os.getenv("HUGGINGFACE_MODEL", "mistralai/Mistral-7B-Instruct-v0.2")

# GigaChat настройки
GIGACHAT_CLIENT_ID = os.getenv("GIGACHAT_CLIENT_ID", "")
GIGACHAT_CLIENT_SECRET = os.getenv("GIGACHAT_CLIENT_SECRET", "")
GIGACHAT_SCOPE = os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS")

# YandexGPT настройки
YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
YANDEX_FOLDER_ID = os.getenv("YANDEX_FOLDER_ID", "")

# Ollama настройки (локальный)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama2")

# AI настройки для генерации изображений
# Варианты: "craiyon", "stabilityai", "fusionbrain", "replicate", "huggingface", "none"
# Рекомендуется: "craiyon" (полностью бесплатный, без регистрации) или "fusionbrain" (Kandinsky от Сбера)
# ПРИНУДИТЕЛЬНО устанавливаем "craiyon" (игнорируем переменные окружения)
AI_IMAGE_SERVICE = "craiyon"  # Принудительно Craiyon (бесплатный, без регистрации)

# Hugging Face для изображений
# Пробуем разные модели, которые могут работать через Inference API
# Варианты: stabilityai/stable-diffusion-2-1, runwayml/stable-diffusion-v1-5, CompVis/stable-diffusion-v1-4
HUGGINGFACE_IMAGE_MODEL = os.getenv("HUGGINGFACE_IMAGE_MODEL", "runwayml/stable-diffusion-v1-5")

# FusionBrain настройки
FUSIONBRAIN_API_KEY = os.getenv("FUSIONBRAIN_API_KEY", "")
FUSIONBRAIN_SECRET_KEY = os.getenv("FUSIONBRAIN_SECRET_KEY", "")

# Replicate настройки
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")

# Stability AI настройки (бесплатный tier доступен)
STABILITYAI_API_KEY = os.getenv("STABILITYAI_API_KEY", "")

# Craiyon настройки (полностью бесплатный, без API ключа)
# Не требует API ключа, но может быть медленнее

# Настройки парсинга
NEWS_HISTORY_FILE = "news_history.json"
MAX_NEWS_AGE_HOURS = 24  # Максимальный возраст новости в часах

# Настройки планировщика
PUBLISH_INTERVAL_HOURS = 6  # Интервал публикации новостей в часах
PUBLISH_TIMES = ["09:00", "15:00", "21:00"]  # Время публикации (МСК)

# Настройки форматирования
# ВКЛЮЧЕНО: Используем Craiyon (бесплатный, без регистрации)
ENABLE_IMAGE_GENERATION = True  # Включено с Craiyon (бесплатный сервис)
MAX_TEXT_LENGTH = 4096  # Максимальная длина сообщения в Telegram

