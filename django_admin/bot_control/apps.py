from django.apps import AppConfig
import os
import threading
import logging

logger = logging.getLogger(__name__)

class BotControlConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'bot_control'
    
    def ready(self):
        import bot_control.bot_admin  # Регистрируем админку для моделей бота
        # Запуск авто-пополнения (watcher) при старте Django
        try:
            # Избегаем двойного запуска в режиме autoreload
            if os.environ.get('RUN_MAIN') == 'true' or os.environ.get('DJANGO_RUNSERVER') == 'true' or os.environ.get('GUNICORN_WORKER'):
                self._start_autodeposit_watcher_once()
        except Exception as e:
            logger.warning(f"Autodeposit watcher init skipped: {e}")

    _watcher_started = False

    def _start_autodeposit_watcher_once(self):
        if BotControlConfig._watcher_started:
            return
        BotControlConfig._watcher_started = True

        try:
            from django.conf import settings
            # Убедимся, что BASE_DIR (django_admin/) в sys.path, чтобы импортировать пакет autodeposit
            try:
                import sys
                base_dir = str(getattr(settings, 'BASE_DIR', ''))
                if base_dir and base_dir not in sys.path:
                    sys.path.insert(0, base_dir)
            except Exception:
                pass
            # Теперь импортируем watcher из пакета autodeposit
            from autodeposit.watcher import AutoDepositWatcher
            import asyncio

            db_path = str(getattr(settings, 'BOT_DATABASE_PATH', '') or '')
            if not db_path:
                logger.info("Autodeposit watcher: BOT_DATABASE_PATH is not set; skip")
                return

            # Фоновый поток с собственным event loop
            def _thread_worker():
                try:
                    asyncio.set_event_loop(asyncio.new_event_loop())
                    loop = asyncio.get_event_loop()
                    watcher = AutoDepositWatcher(db_path=db_path, bot=None, loop=loop)

                    async def _runner():
                        try:
                            await watcher.start()
                            # Держим цикл живым
                            while True:
                                await asyncio.sleep(3600)
                        except Exception as e:
                            logger.error(f"Autodeposit watcher runner error: {e}")

                    loop.create_task(_runner())
                    loop.run_forever()
                except Exception as e:
                    logger.error(f"Autodeposit watcher thread error: {e}")

            t = threading.Thread(target=_thread_worker, name='AutodepositWatcherThread', daemon=True)
            t.start()
            logger.info("Autodeposit watcher thread started from Django AppConfig")
        except Exception as e:
            logger.error(f"Failed to start autodeposit watcher: {e}")


