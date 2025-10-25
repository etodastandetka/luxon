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

DEBUG = True

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
    'rest_framework.authtoken',
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
    'middleware.auth_middleware.AuthMiddleware',
]

# CORS настройки для API
CORS_ALLOW_ALL_ORIGINS = False  # Отключаем для админки
CORS_ALLOW_CREDENTIALS = False
DJANGO_ADMIN_API_TOKEN = "dastan10dz"

# CSRF настройки
CSRF_TRUSTED_ORIGINS = [
    'https://xendro.pro',
    'https://www.xendro.pro',
    'http://xendro.pro',
    'http://www.xendro.pro',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
]

# Настройки сессий
SESSION_COOKIE_SECURE = False  # Для HTTP
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_AGE = 86400  # 24 часа

# CSRF настройки
CSRF_COOKIE_SECURE = False  # Для HTTP
CSRF_COOKIE_HTTPONLY = True
CSRF_USE_SESSIONS = True

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
        # База Django (models, admin). Храним рядом с проектом.
        'NAME': str(BASE_DIR / 'admin.sqlite3'),
    }
}

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Asia/Bishkek'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
# Каталог для collectstatic (поднимайте Nginx/услугу на этот путь)
STATIC_ROOT = '/var/www/luxon/django_admin/staticfiles'
# Serve both app static and repo-level images/ as static
STATICFILES_DIRS = [
    BASE_DIR / 'static',
    PROJECT_ROOT / 'images',
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Настройки аутентификации и редиректа
LOGIN_REDIRECT_URL = '/'
LOGIN_URL = '/login/'
LOGOUT_REDIRECT_URL = '/login/'

# Настройки 2FA
TWO_FACTOR_ENABLED = True
TWO_FACTOR_REMEMBER_DAYS = 30

BOT_TOKEN = '7489617815:AAFt-qZwXCHZYdjWDiihq9slYxg1c8UCzCg'
# Единый путь к базе бота. Бот пишет в bot/universal_bot.db в корне репозитория на сервере.
# Путь к базе данных бота (адаптирован для Windows)
BOT_DATABASE_PATH = PROJECT_ROOT / 'universal_bot.db'

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

# Media files (user uploads, receipts)
# MEDIA_URL is the public URL, MEDIA_ROOT is the filesystem path where uploads are stored.
MEDIA_URL = '/media/'
# Put media under project root so both bot and Django can access saved receipts
MEDIA_ROOT = PROJECT_ROOT / 'media'

# Django REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # Временно разрешаем всем
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20
}

# Настройки сессий для постоянного входа
SESSION_COOKIE_AGE = 30 * 24 * 60 * 60  # 30 дней
SESSION_COOKIE_SECURE = False  # True для HTTPS
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_SAVE_EVERY_REQUEST = True
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
