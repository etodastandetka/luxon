"""
Планировщик для автоматической публикации новостей
"""
import logging
import asyncio
from datetime import datetime, time
from typing import List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


class NewsScheduler:
    def __init__(self, publish_callback):
        self.scheduler = AsyncIOScheduler()
        self.publish_callback = publish_callback
        self.is_running = False
    
    def add_daily_schedule(self, times: List[str]):
        """Добавляет расписание публикаций на каждый день"""
        for time_str in times:
            try:
                hour, minute = map(int, time_str.split(':'))
                trigger = CronTrigger(hour=hour, minute=minute)
                self.scheduler.add_job(
                    self._publish_job,
                    trigger=trigger,
                    id=f"publish_{time_str}",
                    replace_existing=True
                )
                logger.info(f"Добавлено расписание публикации: {time_str}")
            except Exception as e:
                logger.error(f"Ошибка добавления расписания {time_str}: {e}")
    
    def add_interval_schedule(self, hours: int):
        """Добавляет публикацию по интервалу"""
        self.scheduler.add_job(
            self._publish_job,
            trigger='interval',
            hours=hours,
            id='publish_interval',
            replace_existing=True
        )
        logger.info(f"Добавлено интервальное расписание: каждые {hours} часов")
    
    async def _publish_job(self):
        """Задача публикации новости"""
        try:
            logger.info("Запуск запланированной публикации новости")
            await self.publish_callback()
        except Exception as e:
            logger.error(f"Ошибка в задаче публикации: {e}")
    
    def start(self):
        """Запускает планировщик"""
        if not self.is_running:
            self.scheduler.start()
            self.is_running = True
            logger.info("Планировщик запущен")
    
    def stop(self):
        """Останавливает планировщик"""
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Планировщик остановлен")








































