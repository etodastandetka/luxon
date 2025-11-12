"""
Модуль для парсинга футбольных новостей из RSS-лент
"""
import logging
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import feedparser
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class NewsParser:
    def __init__(self, history_file: str = "news_history.json"):
        self.history_file = history_file
        self.published_urls = self._load_history()
    
    def _load_history(self) -> set:
        """Загружает историю опубликованных новостей"""
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return set(data.get('urls', []))
            except Exception as e:
                logger.error(f"Ошибка загрузки истории: {e}")
        return set()
    
    def _save_history(self):
        """Сохраняет историю опубликованных новостей"""
        try:
            data = {
                'urls': list(self.published_urls),
                'last_update': datetime.now().isoformat()
            }
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Ошибка сохранения истории: {e}")
    
    async def _fetch_rss(self, url: str) -> Optional[feedparser.FeedParserDict]:
        """Получает RSS-ленту"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                response.raise_for_status()
                return feedparser.parse(response.text)
        except Exception as e:
            logger.error(f"Ошибка получения RSS {url}: {e}")
            return None
    
    async def _get_article_content(self, url: str) -> Optional[str]:
        """Получает полный текст статьи по URL"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Пытаемся найти основной контент статьи
                # Для разных сайтов могут быть разные селекторы
                content_selectors = [
                    'article',
                    '.article-content',
                    '.post-content',
                    '.news-content',
                    '[itemprop="articleBody"]',
                    '.text'
                ]
                
                for selector in content_selectors:
                    content = soup.select_one(selector)
                    if content:
                        # Удаляем скрипты и стили
                        for script in content(["script", "style"]):
                            script.decompose()
                        text = content.get_text(separator='\n', strip=True)
                        if len(text) > 100:  # Минимальная длина текста
                            return text
                
                # Если не нашли, возвращаем весь текст body
                body = soup.find('body')
                if body:
                    for script in body(["script", "style"]):
                        script.decompose()
                    return body.get_text(separator='\n', strip=True)
                
                return None
        except Exception as e:
            logger.error(f"Ошибка получения контента статьи {url}: {e}")
            return None
    
    def _parse_entry(self, entry: feedparser.FeedParserDict, rss_url: str = "") -> Optional[Dict]:
        """Парсит одну запись из RSS"""
        try:
            url = entry.get('link', '')
            if not url or url in self.published_urls:
                return None
            
            title = entry.get('title', '').strip()
            if not title:
                return None
            
            # Фильтруем только футбольные новости (если это общий RSS)
            # Для специализированных RSS (football.xml) фильтрация не нужна
            is_football_rss = 'football' in rss_url.lower() or 'футбол' in rss_url.lower()
            
            # Если это не специализированный футбольный RSS, фильтруем по ключевым словам
            if not is_football_rss:
                football_keywords = [
                    # Русские ключевые слова
                    'футбол', 'футболист', 'матч', 'чемпионат', 'лига', 'клуб', 'тренер', 
                    'гол', 'голкипер', 'защитник', 'нападающий', 'полузащитник', 'стадион', 
                    'чемпион', 'фк', 'чемпионс лиг', 'премьер-лига', 'российская премьер-лига',
                    # Английские ключевые слова
                    'football', 'soccer', 'premier league', 'champions league', 'uefa', 
                    'fifa', 'world cup', 'euro', 'la liga', 'serie a', 'bundesliga',
                    # Имена известных лиг и турниров
                    'россия', 'англия', 'испания', 'италия', 'германия', 'франция'
                ]
                title_lower = title.lower()
                description_lower = entry.get('description', '').lower()
                text_to_check = f"{title_lower} {description_lower}"
                
                # Проверяем, есть ли футбольные ключевые слова
                is_football = any(keyword in text_to_check for keyword in football_keywords)
                
                # Если это не футбольная новость, пропускаем
                if not is_football:
                    return None
            
            # Получаем описание
            description = entry.get('description', '').strip()
            
            # Парсим дату
            published_time = None
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                published_time = datetime(*entry.published_parsed[:6])
            elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                published_time = datetime(*entry.updated_parsed[:6])
            
            # Проверяем возраст новости (увеличиваем до 7 дней для тестирования)
            if published_time:
                age = datetime.now() - published_time
                if age > timedelta(days=7):  # Пропускаем очень старые новости
                    return None
            
            return {
                'title': title,
                'description': description,
                'url': url,
                'published': published_time.isoformat() if published_time else None,
                'source': entry.get('link', '').split('/')[2] if entry.get('link') else 'unknown'
            }
        except Exception as e:
            logger.error(f"Ошибка парсинга записи: {e}")
            return None
    
    async def fetch_news(self, sources: List[str], max_news: int = 10) -> List[Dict]:
        """Получает новости из всех источников"""
        all_news = []
        
        for source_url in sources:
            logger.info(f"Парсинг новостей из {source_url}")
            feed = await self._fetch_rss(source_url)
            
            if not feed or not feed.entries:
                logger.warning(f"Нет новостей из {source_url}")
                continue
            
            for entry in feed.entries[:max_news]:
                news_item = self._parse_entry(entry, source_url)
                if news_item:
                    # Получаем полный текст статьи
                    content = await self._get_article_content(news_item['url'])
                    if content:
                        news_item['content'] = content[:2000]  # Ограничиваем длину
                    all_news.append(news_item)
        
        # Сортируем по дате (новые первыми)
        all_news.sort(key=lambda x: x.get('published', ''), reverse=True)
        
        return all_news[:max_news]
    
    def mark_as_published(self, url: str):
        """Отмечает новость как опубликованную"""
        self.published_urls.add(url)
        self._save_history()
    
    def is_published(self, url: str) -> bool:
        """Проверяет, была ли новость уже опубликована"""
        return url in self.published_urls

