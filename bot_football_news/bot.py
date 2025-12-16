#!/usr/bin/env python3
"""
Telegram бот для публикации футбольных новостей в канал LUXON
"""
import logging
import asyncio
import hashlib
from pathlib import Path
from telegram import Bot
from telegram.constants import ParseMode
from telegram.error import TelegramError

from config import (
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHANNEL_ID,
    NEWS_SOURCES,
    PUBLISH_TIMES,
    PUBLISH_INTERVAL_HOURS,
    ENABLE_IMAGE_GENERATION,
    MAX_TEXT_LENGTH,
    USE_ALLSPORTSAPI,
    AI_IMAGE_SERVICE
)
from news_parser import NewsParser
from api_parser import AllSportsAPIParser
from ai_formatter import AIFormatter
from image_generator import ImageGenerator
from scheduler import NewsScheduler

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


class FootballNewsBot:
    def __init__(self):
        self.bot = Bot(token=TELEGRAM_BOT_TOKEN)
        self.channel_id = TELEGRAM_CHANNEL_ID
        # Используем AllSportsAPI если включено, иначе RSS
        if USE_ALLSPORTSAPI:
            self.parser = AllSportsAPIParser()
            logger.info("Используется AllSportsAPI для получения новостей")
        else:
            self.parser = NewsParser()
            logger.info("Используется RSS для получения новостей")
        self.formatter = AIFormatter()
        # Инициализируем генератор изображений
        if ENABLE_IMAGE_GENERATION:
            self.image_generator = ImageGenerator()
            logger.info(f"Генерация изображений включена. Сервис: {AI_IMAGE_SERVICE}")
        else:
            self.image_generator = None
            logger.info("Генерация изображений отключена")
        self.scheduler = NewsScheduler(self.publish_news)
        
        # Проверяем конфигурацию
        if not TELEGRAM_BOT_TOKEN:
            raise ValueError("TELEGRAM_BOT_TOKEN не установлен в переменных окружения")
        if not TELEGRAM_CHANNEL_ID:
            raise ValueError("TELEGRAM_CHANNEL_ID не установлен в переменных окружения")
    
    def _get_news_id(self, url: str) -> str:
        """Генерирует уникальный ID для новости"""
        return hashlib.md5(url.encode()).hexdigest()[:8]
    
    async def publish_news(self):
        """Публикует одну новость в канал"""
        try:
            logger.info("Начинаем публикацию новости...")
            
            # Получаем новости
            news_list = []
            if USE_ALLSPORTSAPI:
                try:
                    news_list = await self.parser.fetch_news(max_news=5)
                    if not news_list:
                        logger.warning("AllSportsAPI не вернул новости, пробуем RSS...")
                        # Fallback на RSS
                        rss_parser = NewsParser()
                        news_list = await rss_parser.fetch_news(NEWS_SOURCES, max_news=5)
                except Exception as e:
                    logger.error(f"Ошибка AllSportsAPI, переключаемся на RSS: {e}")
                    # Fallback на RSS
                    rss_parser = NewsParser()
                    news_list = await rss_parser.fetch_news(NEWS_SOURCES, max_news=5)
            else:
                news_list = await self.parser.fetch_news(NEWS_SOURCES, max_news=5)
            
            if not news_list:
                logger.warning("Нет новых новостей для публикации")
                return
            
            # Берем первую неопубликованную новость
            news_item = None
            for item in news_list:
                if not self.parser.is_published(item['url']):
                    news_item = item
                    break
            
            if not news_item:
                logger.info("Все новости уже опубликованы")
                return
            
            logger.info(f"Публикуем новость: {news_item['title']}")
            
            # Форматируем текст через AI
            formatted_text = await self.formatter.format_news(news_item)
            
            # Обрезаем текст если слишком длинный
            if len(formatted_text) > MAX_TEXT_LENGTH:
                formatted_text = formatted_text[:MAX_TEXT_LENGTH - 50] + "\n\n..."
            
            # Генерируем изображение (если включено)
            image_path = None
            if self.image_generator:
                try:
                    logger.info("Начинаем генерацию изображения...")
                    news_id = self._get_news_id(news_item['url'])
                    # Используем описание новости для генерации изображения
                    news_description = news_item.get('description', '') or news_item.get('content', '')
                    logger.info(f"Генерируем изображение для: {news_item['title'][:50]}...")
                    image_path = await self.image_generator.generate_image(
                        news_item['title'],
                        news_id,
                        news_description
                    )
                    if image_path:
                        logger.info(f"✅ Изображение успешно сгенерировано: {image_path}")
                    else:
                        logger.warning("⚠️ Изображение не было сгенерировано (возвращен None)")
                except Exception as e:
                    logger.error(f"❌ Ошибка генерации изображения: {e}", exc_info=True)
            else:
                logger.info("Генератор изображений не инициализирован (ENABLE_IMAGE_GENERATION=False или AI_IMAGE_SERVICE=none)")
            
            # Отправляем в канал
            try:
                if image_path and Path(image_path).exists():
                    # Отправляем с изображением
                    with open(image_path, 'rb') as photo:
                        await self.bot.send_photo(
                            chat_id=self.channel_id,
                            photo=photo,
                            caption=formatted_text,
                            parse_mode=ParseMode.HTML
                        )
                    logger.info("Новость опубликована с изображением")
                else:
                    # Отправляем только текст
                    await self.bot.send_message(
                        chat_id=self.channel_id,
                        text=formatted_text,
                        parse_mode=ParseMode.HTML,
                        disable_web_page_preview=False
                    )
                    logger.info("Новость опубликована без изображения")
                
                # Отмечаем как опубликованную
                self.parser.mark_as_published(news_item['url'])
                logger.info(f"✅ Новость успешно опубликована: {news_item['title']}")
                
            except TelegramError as e:
                error_msg = str(e)
                if "Chat not found" in error_msg:
                    logger.error("❌ ОШИБКА: Канал не найден!")
                    logger.error("   Убедитесь, что:")
                    logger.error("   1. Бот добавлен как администратор в канал")
                    logger.error("   2. У бота есть права 'Отправка сообщений'")
                    logger.error("   3. ID канала правильный: {}".format(self.channel_id))
                elif "not enough rights" in error_msg.lower() or "rights" in error_msg.lower():
                    logger.error("❌ ОШИБКА: У бота нет прав на публикацию!")
                    logger.error("   Дайте боту права 'Отправка сообщений' в настройках канала")
                else:
                    logger.error(f"Ошибка Telegram при публикации: {e}")
            except Exception as e:
                logger.error(f"Ошибка при публикации: {e}")
                
        except Exception as e:
            logger.error(f"Критическая ошибка в publish_news: {e}", exc_info=True)
    
    async def test_publish(self):
        """Тестовая публикация (для проверки)"""
        logger.info("Запуск тестовой публикации...")
        await self.publish_news()
    
    def start_scheduler(self):
        """Запускает планировщик"""
        # Добавляем расписание по времени
        if PUBLISH_TIMES:
            self.scheduler.add_daily_schedule(PUBLISH_TIMES)
        
        # Добавляем интервальное расписание
        if PUBLISH_INTERVAL_HOURS:
            self.scheduler.add_interval_schedule(PUBLISH_INTERVAL_HOURS)
        
        self.scheduler.start()
        logger.info("Планировщик запущен")
    
    async def check_channel_access(self) -> bool:
        """Проверяет доступ бота к каналу"""
        try:
            chat = await self.bot.get_chat(self.channel_id)
            logger.info(f"✅ Канал найден: {chat.title or chat.username or self.channel_id}")
            
            # Пробуем отправить тестовое сообщение
            try:
                await self.bot.send_message(
                    chat_id=self.channel_id,
                    text="🤖 <b>Бот запущен и готов к работе!</b>",
                    parse_mode=ParseMode.HTML
                )
                logger.info("✅ Тестовое сообщение отправлено успешно")
                return True
            except TelegramError as e:
                error_msg = str(e)
                if "Chat not found" in error_msg:
                    logger.error("❌ ОШИБКА: Канал не найден или бот не добавлен в канал!")
                    logger.error("   Решение:")
                    logger.error("   1. Убедитесь, что канал существует")
                    logger.error("   2. Добавьте бота @{} как администратора в канал".format((await self.bot.get_me()).username))
                    logger.error("   3. Дайте боту права на 'Отправка сообщений'")
                elif "not enough rights" in error_msg.lower() or "rights" in error_msg.lower():
                    logger.error("❌ ОШИБКА: У бота нет прав на публикацию в канале!")
                    logger.error("   Решение: Дайте боту права 'Отправка сообщений' в настройках канала")
                else:
                    logger.error(f"❌ Ошибка при отправке тестового сообщения: {e}")
                return False
        except TelegramError as e:
            error_msg = str(e)
            if "Chat not found" in error_msg:
                logger.error("❌ ОШИБКА: Канал не найден!")
                logger.error(f"   Проверьте ID канала: {self.channel_id}")
                logger.error("   Решение:")
                logger.error("   1. Убедитесь, что канал существует")
                logger.error("   2. Добавьте бота как администратора в канал")
                logger.error("   3. Проверьте правильность ID канала (должен начинаться с -100 для супергрупп)")
            else:
                logger.error(f"❌ Ошибка при проверке канала: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Неожиданная ошибка при проверке канала: {e}")
            return False
    
    async def run(self):
        """Основной цикл работы бота"""
        try:
            # Проверяем подключение
            me = await self.bot.get_me()
            logger.info(f"Бот запущен: @{me.username}")
            
            # Проверяем доступ к каналу
            logger.info("Проверка доступа к каналу...")
            if not await self.check_channel_access():
                logger.error("⚠️  Бот не может публиковать в канал. Исправьте проблему и перезапустите бота.")
                logger.info("Бот будет работать, но публикации не будут отправляться до исправления проблемы.")
                # Продолжаем работу, но без публикаций
            else:
                logger.info("✅ Доступ к каналу подтвержден")
            
            # Запускаем планировщик
            self.start_scheduler()
            
            # Делаем первую публикацию сразу для теста (только если доступ есть)
            logger.info("Выполняем тестовую публикацию...")
            await self.publish_news()
            
            # Держим бота запущенным
            logger.info("Бот работает. Нажмите Ctrl+C для остановки.")
            while True:
                await asyncio.sleep(3600)  # Спим час, планировщик работает отдельно
                
        except KeyboardInterrupt:
            logger.info("Получен сигнал остановки")
        except asyncio.CancelledError:
            logger.info("Задача отменена")
        except Exception as e:
            logger.error(f"Критическая ошибка: {e}", exc_info=True)
        finally:
            self.scheduler.stop()
            logger.info("Бот остановлен")


async def main():
    """Главная функция"""
    try:
        bot = FootballNewsBot()
        await bot.run()
    except Exception as e:
        logger.error(f"Ошибка запуска бота: {e}", exc_info=True)


if __name__ == '__main__':
    asyncio.run(main())

