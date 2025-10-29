"""
Middleware для отключения кэширования в development режиме
"""
from django.conf import settings
from django.utils.cache import add_never_cache_headers


class NoCacheMiddleware:
    """
    Middleware для отключения кэширования в DEBUG режиме
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        if settings.DEBUG:
            # Добавляем заголовки для отключения кэширования
            add_never_cache_headers(response)
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
            
        return response
