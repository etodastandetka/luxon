from django.apps import AppConfig

class BotControlConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'bot_control'
    
    def ready(self):
        import bot_control.bot_admin  # Регистрируем админку для моделей бота


