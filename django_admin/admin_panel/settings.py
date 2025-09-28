from pathlib import Path
import os
import sys
from django.http import HttpResponse

# Корневая папка Django-проекта (django_admin/)
BASE_DIR = Path(__file__).resolve().parent.parent

# Добавляем корень всего репо (bets/) в PYTHONPATH, чтобы видеть пакет bot/
PROJECT_ROOT = BASE_DIR.parent  # c:\Users\...\bets
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Подтягиваем креды 1XBET из config.py (при наличии) или из переменных окружения
try:
    from config import XBET_HASH, XBET_CASHIERPASS, XBET_LOGIN, XBET_CASHDESKID
except Exception:
    XBET_HASH = os.getenv('XBET_HASH', '')
    XBET_CASHIERPASS = os.getenv('XBET_CASHIERPASS', '')
    XBET_LOGIN = os.getenv('XBET_LOGIN', '')
    try:
        XBET_CASHDESKID = int(os.getenv('XBET_CASHDESKID', '0') or '0')
    except Exception:
        XBET_CASHDESKID = 0

SECRET_KEY = 'django-insecure-luxservice-online-2025-secure-key-change-in-production'

DEBUG = False

ALLOWED_HOSTS = [
    'xendro.pro', 
    'www.xendro.pro',
    '46.149.69.231',
    'localhost', 
    '127.0.0.1'
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    'rest_framework',
    'bot_control',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'admin_panel.settings.CORSMiddleware',
]

# CORS настройки для API
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
DJANGO_ADMIN_API_TOKEN = "dastan10dz"

# Добавляем CORS middleware
class CORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Handle CORS preflight early
        origin = request.META.get('HTTP_ORIGIN')
        if request.method == 'OPTIONS':
            resp = HttpResponse(status=200)
            if origin:
                resp['Access-Control-Allow-Origin'] = origin
            else:
                resp['Access-Control-Allow-Origin'] = '*'
            resp['Vary'] = 'Origin'
            resp['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            resp['Access-Control-Allow-Headers'] = request.META.get('HTTP_ACCESS_CONTROL_REQUEST_HEADERS', 'Content-Type, Authorization, X-CSRFToken')
            resp['Access-Control-Allow-Credentials'] = 'true'
            resp['Access-Control-Max-Age'] = '86400'
            return resp

        response = self.get_response(request)
        # Echo back Origin for non-preflight to satisfy credentials scenario
        if origin:
            response['Access-Control-Allow-Origin'] = origin
            response['Vary'] = 'Origin'
        else:
            response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken'
        response['Access-Control-Allow-Credentials'] = 'true'
        return response

# Добавляем CORS middleware в начало списка
MIDDLEWARE.insert(0, 'admin_panel.settings.CORSMiddleware')

ROOT_URLCONF = 'admin_panel.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'admin_panel.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        # ВНИМАНИЕ: это база Django (models, admin). Не путать с bot universal DB.
        # Если хотите держать её отдельно, укажите, например: BASE_DIR / 'admin.sqlite3'
        # Здесь оставляем как есть, чтобы не ломать миграции, при необходимости поменяем отдельно.
        'NAME': '/var/www/luxservice/django_admin/admin.sqlite3',
    }
}

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Asia/Bishkek'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = '/var/www/luxservice/django_admin/staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

BOT_TOKEN = '7489617815:AAFt-qZwXCHZYdjWDiihq9slYxg1c8UCzCg'
# Единый путь к базе бота (универсальная БД): c:\Users\...\bets\universal_bot.db
BOT_DATABASE_PATH = '/var/www/luxservice/universal_bot.db'

# Настройки безопасности для продакшена
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Настройки для работы за прокси
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_TZ = True
