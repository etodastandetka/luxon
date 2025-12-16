"""
Модуль для парсинга футбольных новостей через AllSportsAPI
"""
import logging
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import httpx
from config import ALLSPORTSAPI_KEY, ALLSPORTSAPI_BASE_URL

logger = logging.getLogger(__name__)


class AllSportsAPIParser:
    def __init__(self, history_file: str = "news_history.json"):
        self.history_file = history_file
        self.api_key = ALLSPORTSAPI_KEY
        self.base_url = ALLSPORTSAPI_BASE_URL
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
    
    async def _make_api_request(self, method: str, params: Dict = None) -> Optional[Dict]:
        """Выполняет запрос к AllSportsAPI"""
        if not self.api_key:
            logger.error("AllSportsAPI ключ не установлен")
            return None
        
        try:
            # Формат из документации: https://apiv2.allsportsapi.com/football/?met=METHOD&APIkey=KEY&params
            url = f"{self.base_url}/?met={method}&APIkey={self.api_key}"
            if params:
                for key, value in params.items():
                    url += f"&{key}={value}"
            
            logger.debug(f"Запрос к AllSportsAPI: {url.replace(self.api_key, '***')}")
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                })
                
                logger.debug(f"Ответ AllSportsAPI {method}: {response.status_code}")
                
                if response.status_code != 200:
                    logger.error(f"HTTP ошибка AllSportsAPI {method}: {response.status_code} - {response.text[:200]}")
                    return None
                
                try:
                    return response.json()
                except Exception as e:
                    logger.error(f"Ошибка парсинга JSON от AllSportsAPI: {e} - {response.text[:200]}")
                    return None
                    
        except httpx.TimeoutException:
            logger.error(f"Таймаут запроса к AllSportsAPI {method}")
            return None
        except Exception as e:
            logger.error(f"Ошибка запроса к AllSportsAPI {method}: {e}")
            return None
    
    async def get_leagues(self) -> List[Dict]:
        """Получает доступные лиги (для бесплатного плана - 2 случайные лиги в год)"""
        data = await self._make_api_request('Leagues')
        
        if data:
            if isinstance(data, dict):
                if data.get('success') == 1 and data.get('result'):
                    result = data.get('result', [])
                    if isinstance(result, list):
                        logger.info(f"Получено {len(result)} лиг")
                        return result
                    elif isinstance(result, dict):
                        return list(result.values()) if result else []
                elif 'result' in data:
                    result = data.get('result', [])
                    if result:
                        if isinstance(result, list):
                            return result
                        elif isinstance(result, dict):
                            return list(result.values()) if result else []
            elif isinstance(data, list):
                if data:
                    return data
        
        logger.warning("Не удалось получить лиги")
        return []
    
    async def get_fixtures(self, from_date: str = None, to_date: str = None, league_id: int = None) -> List[Dict]:
        """Получает расписание матчей (Fixtures) - доступно в бесплатном плане"""
        method = 'Fixtures'
        # Fixtures требует обязательные параметры from и to
        if not from_date or not to_date:
            today = datetime.now()
            from_date = from_date or (today - timedelta(days=7)).strftime('%Y-%m-%d')
            to_date = to_date or (today + timedelta(days=7)).strftime('%Y-%m-%d')
        
        params = {
            'from': from_date,
            'to': to_date
        }
        if league_id:
            params['leagueId'] = str(league_id)
            
        data = await self._make_api_request(method, params)
        
        if data:
            # Проверяем формат ответа из документации: {"success": 1, "result": [...]}
            if isinstance(data, dict):
                if data.get('success') == 1 and data.get('result'):
                    logger.info(f"Успешно получены данные через метод {method}")
                    result = data.get('result', [])
                    # Если result - это список, возвращаем его
                    if isinstance(result, list):
                        return result
                    # Если result - это dict, преобразуем в список
                    elif isinstance(result, dict):
                        return list(result.values()) if result else []
                elif 'result' in data:
                    result = data.get('result', [])
                    if result:
                        logger.info(f"Успешно получены данные через метод {method}")
                        if isinstance(result, list):
                            return result
                        elif isinstance(result, dict):
                            return list(result.values()) if result else []
            elif isinstance(data, list):
                # Прямой массив результатов
                if data:
                    logger.info(f"Успешно получены данные через метод {method}")
                    return data
        
        logger.warning(f"Не удалось получить матчи через метод {method}")
        return []
    
    async def get_events(self, from_date: str = None, to_date: str = None, league_id: int = None) -> List[Dict]:
        """Получает события/матчи из API (использует Fixtures для бесплатного плана)"""
        # Используем Fixtures вместо Events, так как Events не входит в бесплатный план
        return await self.get_fixtures(from_date=from_date, to_date=to_date, league_id=league_id)
    
    async def get_livescore(self) -> List[Dict]:
        """Получает живые результаты"""
        data = await self._make_api_request('Livescore')
        
        if not data:
            return []
        
        # Проверяем формат ответа из документации: {"success": 1, "result": {...}}
        if isinstance(data, dict):
            if data.get('success') == 1:
                result = data.get('result')
                if result:
                    # Для Livescore result может быть словарем с ключами-идентификаторами матчей
                    if isinstance(result, dict):
                        # Преобразуем словарь в список значений
                        return list(result.values()) if result else []
                    elif isinstance(result, list):
                        return result
                else:
                    # Success = 1, но result отсутствует или пустой - нет активных матчей
                    logger.info("AllSportsAPI Livescore: нет активных матчей")
                    return []
            elif 'result' in data:
                result = data.get('result', {})
                if result:
                    if isinstance(result, dict):
                        return list(result.values()) if result else []
                    elif isinstance(result, list):
                        return result
        elif isinstance(data, list):
            if data:
                return data
        
        logger.warning(f"AllSportsAPI Livescore вернул неожиданный формат: {type(data)}")
        return []
    
    async def get_odds(self, match_id: int = None, from_date: str = None, to_date: str = None) -> Optional[Dict]:
        """Получает коэффициенты букмекеров для матча (доступно в бесплатном плане)"""
        method = 'Odds'
        params = {}
        if match_id:
            params['matchId'] = str(match_id)
        if from_date:
            params['from'] = from_date
        if to_date:
            params['to'] = to_date
        
        data = await self._make_api_request(method, params)
        
        if data and isinstance(data, dict):
            if data.get('success') == 1 and data.get('result'):
                result = data.get('result', {})
                if isinstance(result, dict):
                    return result
            elif 'result' in data:
                result = data.get('result', {})
                if result:
                    return result
        
        return None
    
    async def get_probabilities(self, match_id: int = None, from_date: str = None, to_date: str = None) -> Optional[List[Dict]]:
        """Получает вероятности исходов матча (доступно в бесплатном плане)"""
        method = 'Probabilities'
        params = {}
        if match_id:
            params['matchId'] = str(match_id)
        if from_date:
            params['from'] = from_date
        if to_date:
            params['to'] = to_date
        
        data = await self._make_api_request(method, params)
        
        if data and isinstance(data, dict):
            if data.get('success') == 1 and data.get('result'):
                result = data.get('result', [])
                if isinstance(result, list) and len(result) > 0:
                    return result
            elif 'result' in data:
                result = data.get('result', [])
                if isinstance(result, list) and len(result) > 0:
                    return result
        
        return None
    
    def _format_event_to_news(self, event: Dict) -> Optional[Dict]:
        """Преобразует событие из API в формат новости"""
        try:
            # Пробуем разные варианты ключей (API может использовать разные названия)
            event_id = event.get('event_key') or event.get('event_id') or event.get('id') or event.get('match_id', '')
            match_date = event.get('event_date') or event.get('date') or event.get('match_date', '')
            home_team = event.get('event_home_team') or event.get('home_team') or event.get('team_home', '')
            away_team = event.get('event_away_team') or event.get('away_team') or event.get('team_away', '')
            league = event.get('league_name') or event.get('league') or event.get('competition', '')
            
            # Если нет хотя бы команд, пропускаем
            if not home_team or not away_team:
                return None
            
            # Если нет event_id, создаем из команд и даты
            if not event_id:
                event_id = f"{home_team}_{away_team}_{match_date}".replace(' ', '_').lower()
            
            # Создаем URL для события (используем event_key как уникальный идентификатор)
            url = f"https://allsportsapi.com/event/{event_id}"
            
            if url in self.published_urls:
                return None
            
            # Формируем заголовок
            home_score = event.get('event_final_result', '').split('-')[0].strip() if event.get('event_final_result') else ''
            away_score = event.get('event_final_result', '').split('-')[1].strip() if event.get('event_final_result') else '' if event.get('event_final_result') else ''
            
            if home_score and away_score:
                title = f"{home_team} {home_score}:{away_score} {away_team}"
            else:
                title = f"{home_team} vs {away_team}"
            
            if league:
                title += f" ({league})"
            
            # Формируем описание
            description_parts = []
            if match_date:
                try:
                    date_obj = datetime.strptime(match_date, '%Y-%m-%d')
                    description_parts.append(f"📅 {date_obj.strftime('%d.%m.%Y')}")
                except:
                    description_parts.append(f"📅 {match_date}")
            
            if event.get('event_status'):
                description_parts.append(f"Статус: {event.get('event_status')}")
            
            if event.get('event_final_result'):
                description_parts.append(f"Результат: {event.get('event_final_result')}")
            
            description = " | ".join(description_parts) if description_parts else ""
            
            # Формируем полный текст
            content_parts = [f"⚽ Матч: {home_team} vs {away_team}"]
            if league:
                content_parts.append(f"🏆 Лига: {league}")
            if match_date:
                content_parts.append(f"📅 Дата: {match_date}")
            if event.get('event_time'):
                content_parts.append(f"⏰ Время: {event.get('event_time')}")
            if event.get('event_final_result'):
                content_parts.append(f"📊 Результат: {event.get('event_final_result')}")
            if event.get('event_status'):
                content_parts.append(f"📌 Статус: {event.get('event_status')}")
            
            content = "\n".join(content_parts)
            
            return {
                'title': title,
                'description': description,
                'content': content,
                'url': url,
                'published': match_date if match_date else datetime.now().isoformat(),
                'source': 'AllSportsAPI',
                'event_data': event,  # Сохраняем полные данные события
                'event_key': event_id,  # Сохраняем event_key для получения коэффициентов
                'match_id': event_id  # Для совместимости
            }
        except Exception as e:
            logger.error(f"Ошибка форматирования события: {e}")
            return None
    
    async def fetch_news(self, max_news: int = 10) -> List[Dict]:
        """Получает новости из AllSportsAPI (использует доступные методы бесплатного плана)"""
        all_news = []
        
        try:
            # Сначала пробуем Livescore (текущие матчи) - доступно в бесплатном плане
            logger.info("Попытка получить Livescore...")
            livescore = await self.get_livescore()
            
            if livescore:
                logger.info(f"Получено {len(livescore)} живых матчей")
                for event in livescore[:max_news]:
                    news_item = self._format_event_to_news(event)
                    if news_item:
                        all_news.append(news_item)
            
            # Если не получили достаточно, пробуем получить доступные лиги
            if len(all_news) < max_news:
                logger.info("Получение доступных лиг...")
                leagues = await self.get_leagues()
                
                if leagues:
                    logger.info(f"Доступно {len(leagues)} лиг")
                    # Берем первую доступную лигу (или несколько)
                    league_ids = [league.get('league_key') or league.get('league_id') for league in leagues[:2] if league.get('league_key') or league.get('league_id')]
                    
                    # Пробуем получить матчи из доступных лиг
                    today = datetime.now()
                    from_date = (today - timedelta(days=7)).strftime('%Y-%m-%d')
                    to_date = (today + timedelta(days=7)).strftime('%Y-%m-%d')
                    
                    for league_id in league_ids:
                        if len(all_news) >= max_news:
                            break
                        
                        logger.info(f"Запрос матчей лиги {league_id} с {from_date} по {to_date}")
                        fixtures = await self.get_fixtures(from_date=from_date, to_date=to_date, league_id=league_id)
                        
                        if fixtures:
                            logger.info(f"Получено {len(fixtures)} матчей из лиги {league_id}")
                            
                            # Преобразуем матчи в новости
                            for event in fixtures:
                                if len(all_news) >= max_news:
                                    break
                                news_item = self._format_event_to_news(event)
                                if news_item and news_item['url'] not in [n['url'] for n in all_news]:
                                    all_news.append(news_item)
                else:
                    # Если не получили лиги, пробуем Fixtures без указания лиги
                    logger.info("Пробуем получить матчи без указания лиги...")
                    today = datetime.now()
                    from_date = (today - timedelta(days=7)).strftime('%Y-%m-%d')
                    to_date = (today + timedelta(days=7)).strftime('%Y-%m-%d')
                    
                    fixtures = await self.get_fixtures(from_date=from_date, to_date=to_date)
                    
                    if fixtures:
                        logger.info(f"Получено {len(fixtures)} матчей")
                        
                        for event in fixtures:
                            if len(all_news) >= max_news:
                                break
                            news_item = self._format_event_to_news(event)
                            if news_item and news_item['url'] not in [n['url'] for n in all_news]:
                                all_news.append(news_item)
            
            if not all_news:
                logger.warning("Нет событий из AllSportsAPI")
                return []
            
            # Сортируем по дате (новые первыми)
            all_news.sort(key=lambda x: x.get('published', ''), reverse=True)
            
            logger.info(f"Итого подготовлено {len(all_news)} новостей")
            return all_news[:max_news]
            
        except Exception as e:
            logger.error(f"Ошибка получения новостей из AllSportsAPI: {e}", exc_info=True)
            return []
    
    def mark_as_published(self, url: str):
        """Отмечает новость как опубликованную"""
        self.published_urls.add(url)
        self._save_history()
    
    def is_published(self, url: str) -> bool:
        """Проверяет, была ли новость уже опубликована"""
        return url in self.published_urls

