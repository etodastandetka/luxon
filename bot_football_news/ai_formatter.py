"""
Модуль для форматирования текста новостей с помощью AI
"""
import logging
import httpx
import json
import base64
from datetime import datetime
from typing import Optional, Dict
from config import (
    AI_TEXT_SERVICE,
    HUGGINGFACE_API_KEY,
    HUGGINGFACE_MODEL,
    GIGACHAT_CLIENT_ID,
    GIGACHAT_CLIENT_SECRET,
    GIGACHAT_SCOPE,
    YANDEX_API_KEY,
    YANDEX_FOLDER_ID,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL
)

logger = logging.getLogger(__name__)


class AIFormatter:
    def __init__(self):
        self.service = AI_TEXT_SERVICE
    
    async def format_news(self, news_item: Dict) -> str:
        """Форматирует новость с помощью AI"""
        title = news_item.get('title', '')
        description = news_item.get('description', '')
        content = news_item.get('content', description)
        url = news_item.get('url', '')
        source = news_item.get('source', '')
        
        # Если это данные из AllSportsAPI (матч), используем специальное форматирование
        if source == 'AllSportsAPI' and news_item.get('event_data'):
            return await self._format_match_news(news_item)
        
        prompt = f"""Переформатируй эту футбольную новость для Telegram канала LUXON. 

Заголовок: {title}
Текст: {content[:1500]}

Требования:
1. Создай интересный заголовок (жирный, с эмодзи)
2. Добавь краткое описание новости
3. Выдели ключевые моменты цитатами
4. Добавь прогноз или анализ ситуации (если это уместно)
5. Используй Telegram HTML форматирование: <b>жирный</b>, <i>курсив</i>, <blockquote>цитаты</blockquote>
6. Добавь релевантные хештеги в конце
7. Сделай текст увлекательным и информативным
8. Максимум 2000 символов

Формат ответа - только текст без дополнительных пояснений."""

        try:
            if self.service == "huggingface":
                formatted = await self._format_huggingface(prompt)
            elif self.service == "gigachat":
                formatted = await self._format_gigachat(prompt)
            elif self.service == "yandexgpt":
                formatted = await self._format_yandexgpt(prompt)
            elif self.service == "ollama":
                formatted = await self._format_ollama(prompt)
            else:
                formatted = self._format_simple(news_item)
            
            # Если AI вернул пустой результат, используем простое форматирование
            if not formatted or not formatted.strip():
                logger.warning("AI вернул пустой результат, используем простое форматирование")
                formatted = self._format_simple(news_item)
            
            # Ссылку на источник не добавляем
            return formatted
            
        except Exception as e:
            logger.error(f"Ошибка форматирования через AI: {e}")
            return self._format_simple(news_item)
    
    async def _format_huggingface(self, prompt: str) -> str:
        """Форматирование через Hugging Face Inference API"""
        if not HUGGINGFACE_API_KEY:
            logger.warning("Hugging Face API ключ не установлен")
            return ""
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"https://api-inference.huggingface.co/models/{HUGGINGFACE_MODEL}",
                    headers={
                        "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "inputs": prompt,
                        "parameters": {
                            "max_new_tokens": 500,
                            "temperature": 0.7,
                            "return_full_text": False
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if isinstance(result, list) and len(result) > 0:
                        return result[0].get('generated_text', '')
                    elif isinstance(result, dict):
                        return result.get('generated_text', '')
                else:
                    logger.error(f"Hugging Face API ошибка: {response.status_code} - {response.text}")
                    return ""
        except Exception as e:
            logger.error(f"Ошибка Hugging Face API: {e}")
            return ""
    
    async def _format_gigachat(self, prompt: str) -> str:
        """Форматирование через GigaChat API"""
        if not GIGACHAT_CLIENT_ID or not GIGACHAT_CLIENT_SECRET:
            logger.warning("GigaChat credentials не установлены")
            return ""
        
        try:
            # Получаем токен доступа
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Кодируем credentials в base64 для Basic auth
                credentials = f"{GIGACHAT_CLIENT_ID}:{GIGACHAT_CLIENT_SECRET}"
                encoded_credentials = base64.b64encode(credentials.encode()).decode()
                
                auth_response = await client.post(
                    "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
                    headers={
                        "Authorization": f"Basic {encoded_credentials}",
                        "RqUID": "123456789",
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    data={"scope": GIGACHAT_SCOPE}
                )
                
                if auth_response.status_code != 200:
                    logger.error(f"GigaChat auth ошибка: {auth_response.status_code}")
                    return ""
                
                access_token = auth_response.json().get('access_token')
                if not access_token:
                    return ""
                
                # Отправляем запрос к API
                chat_response = await client.post(
                    "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "GigaChat",
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.7,
                        "max_tokens": 1000
                    }
                )
                
                if chat_response.status_code == 200:
                    result = chat_response.json()
                    return result.get('choices', [{}])[0].get('message', {}).get('content', '')
                else:
                    logger.error(f"GigaChat API ошибка: {chat_response.status_code}")
                    return ""
        except Exception as e:
            logger.error(f"Ошибка GigaChat API: {e}")
            return ""
    
    async def _format_yandexgpt(self, prompt: str) -> str:
        """Форматирование через YandexGPT API"""
        if not YANDEX_API_KEY or not YANDEX_FOLDER_ID:
            logger.warning("YandexGPT credentials не установлены")
            return ""
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
                    headers={
                        "Authorization": f"Api-Key {YANDEX_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "modelUri": f"gpt://{YANDEX_FOLDER_ID}/yandexgpt/latest",
                        "completionOptions": {
                            "stream": False,
                            "temperature": 0.7,
                            "maxTokens": 1000
                        },
                        "messages": [
                            {
                                "role": "user",
                                "text": prompt
                            }
                        ]
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get('result', {}).get('alternatives', [{}])[0].get('message', {}).get('text', '')
                else:
                    logger.error(f"YandexGPT API ошибка: {response.status_code}")
                    return ""
        except Exception as e:
            logger.error(f"Ошибка YandexGPT API: {e}")
            return ""
    
    async def _format_ollama(self, prompt: str) -> str:
        """Форматирование через локальный Ollama"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "num_predict": 1000
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get('response', '')
                else:
                    logger.error(f"Ollama API ошибка: {response.status_code}")
                    return ""
        except Exception as e:
            logger.error(f"Ошибка Ollama API: {e}")
            return ""
    
    async def _get_match_predictions(self, news_item: Dict) -> Dict:
        """Получает коэффициенты и вероятности для матча"""
        from api_parser import AllSportsAPIParser
        
        event_key = news_item.get('event_key') or news_item.get('match_id')
        event_data = news_item.get('event_data', {})
        
        if not event_key:
            # Пробуем извлечь из event_data
            event_key = event_data.get('event_key') or event_data.get('event_id') or event_data.get('match_id')
        
        predictions = {
            'odds': None,
            'probabilities': None
        }
        
        if event_key:
            try:
                parser = AllSportsAPIParser()
                # Получаем коэффициенты
                odds = await parser.get_odds(match_id=int(event_key) if str(event_key).isdigit() else None)
                if odds:
                    predictions['odds'] = odds
                
                # Получаем вероятности
                probabilities = await parser.get_probabilities(match_id=int(event_key) if str(event_key).isdigit() else None)
                if probabilities:
                    predictions['probabilities'] = probabilities[0] if isinstance(probabilities, list) and len(probabilities) > 0 else probabilities
            except Exception as e:
                logger.warning(f"Ошибка получения прогнозов: {e}")
        
        return predictions
    
    async def _format_match_news(self, news_item: Dict) -> str:
        """Форматирование новости о матче из AllSportsAPI в формате статьи"""
        event_data = news_item.get('event_data', {})
        title = news_item.get('title', '')
        
        home_team = event_data.get('event_home_team', '')
        away_team = event_data.get('event_away_team', '')
        league = event_data.get('league_name', '')
        country = event_data.get('country_name', '')
        match_date = event_data.get('event_date', '')
        match_time = event_data.get('event_time', '')
        result = event_data.get('event_final_result', '')
        status = event_data.get('event_status', '')
        stadium = event_data.get('event_stadium', '')
        league_round = event_data.get('league_round', '')
        league_season = event_data.get('league_season', '')
        
        # Форматируем дату
        date_str = ""
        if match_date:
            try:
                date_obj = datetime.strptime(match_date, '%Y-%m-%d')
                date_str = date_obj.strftime('%d.%m.%Y')
                if match_time:
                    date_str += f" в {match_time}"
            except:
                date_str = match_date
        
        # Начинаем статью с интересного заголовка
        formatted = f"⚽ <b>{title}</b>\n\n"
        
        # Вступление
        if status == "Not Started" or status == "":
            formatted += f"<blockquote>"
            formatted += f"В {league if league else 'футбольном турнире'} готовится захватывающий поединок между {home_team} и {away_team}."
            if date_str:
                formatted += f" Матч состоится {date_str}."
            if stadium:
                formatted += f" Арена встречи - {stadium}."
            formatted += f"</blockquote>\n\n"
        elif status == "Finished" and result:
            formatted += f"<blockquote>"
            formatted += f"Матч в {league if league else 'турнире'} завершился со счетом {result}."
            formatted += f" {home_team} и {away_team} провели напряженную игру."
            if date_str:
                formatted += f" Встреча прошла {date_str}."
            formatted += f"</blockquote>\n\n"
        else:
            formatted += f"<blockquote>"
            formatted += f"В {league if league else 'футбольном турнире'} состоялся матч между {home_team} и {away_team}."
            if date_str:
                formatted += f" Встреча прошла {date_str}."
            formatted += f"</blockquote>\n\n"
        
        # Основная информация
        formatted += "<b>📋 Детали матча:</b>\n\n"
        
        if league:
            formatted += f"🏆 <b>Лига:</b> {league}"
            if country:
                formatted += f" ({country})"
            formatted += "\n"
        
        if league_season:
            formatted += f"📅 <b>Сезон:</b> {league_season}\n"
        
        if league_round:
            formatted += f"🔄 <b>Тур:</b> {league_round}\n"
        
        if date_str:
            formatted += f"⏰ <b>Дата и время:</b> {date_str}\n"
        
        if stadium:
            formatted += f"🏟️ <b>Стадион:</b> {stadium}\n"
        
        if result and result != "-":
            formatted += f"📊 <b>Итоговый счет:</b> {result}\n"
        
        if status:
            status_ru = {
                "Not Started": "Не начался",
                "Finished": "Завершен",
                "Live": "В прямом эфире",
                "Postponed": "Перенесен",
                "Cancelled": "Отменен"
            }.get(status, status)
            formatted += f"📌 <b>Статус:</b> {status_ru}\n"
        
        formatted += "\n"
        
        # Получаем прогнозы с коэффициентами (только для будущих матчей)
        predictions = None
        if status == "Not Started" or status == "":
            try:
                predictions = await self._get_match_predictions(news_item)
            except Exception as e:
                logger.warning(f"Не удалось получить прогнозы: {e}")
        
        # Анализ и прогноз
        formatted += "<b>📈 Анализ и прогноз:</b>\n\n"
        
        if status == "Not Started" or status == "":
            # Добавляем прогноз с коэффициентами
            if predictions and (predictions.get('odds') or predictions.get('probabilities')):
                formatted += self._format_predictions(home_team, away_team, predictions, league)
            else:
                formatted += "<blockquote>"
                formatted += f"Ожидается интересный матч между {home_team} и {away_team}. "
                formatted += f"Обе команды готовятся к важной встрече в рамках {league if league else 'турнира'}. "
                formatted += f"Болельщики с нетерпением ждут начала игры и надеются увидеть зрелищный футбол. "
                formatted += f"Следите за трансляцией и результатами матча!"
                formatted += "</blockquote>\n\n"
        elif status == "Finished" and result:
            scores = result.split('-')
            if len(scores) == 2:
                try:
                    home_score = int(scores[0].strip())
                    away_score = int(scores[1].strip())
                    if home_score > away_score:
                        formatted += f"<blockquote>"
                        formatted += f"{home_team} одержали победу со счетом {result}. "
                        formatted += f"Команда показала отличную игру и заслуженно выиграла матч. "
                        formatted += f"{away_team} сражались до конца, но не смогли переломить ход встречи."
                        formatted += f"</blockquote>\n\n"
                    elif away_score > home_score:
                        formatted += f"<blockquote>"
                        formatted += f"{away_team} выиграли со счетом {result}. "
                        formatted += f"Гости показали сильную игру и заслужили победу. "
                        formatted += f"{home_team} пытались отыграться, но соперник был сильнее."
                        formatted += f"</blockquote>\n\n"
                    else:
                        formatted += f"<blockquote>"
                        formatted += f"Матч завершился вничью {result}. "
                        formatted += f"Обе команды показали равную игру и разделили очки. "
                        formatted += f"Игра была напряженной и интересной до последней минуты."
                        formatted += f"</blockquote>\n\n"
                except:
                    formatted += f"<blockquote>"
                    formatted += f"Матч завершился со счетом {result}. "
                    formatted += f"Обе команды показали достойную игру в рамках {league if league else 'турнира'}."
                    formatted += f"</blockquote>\n\n"
            else:
                formatted += f"<blockquote>"
                formatted += f"Матч завершился. Результат встречи: {result}. "
                formatted += f"Обе команды провели интересную игру."
                formatted += f"</blockquote>\n\n"
        else:
            formatted += f"<blockquote>"
            formatted += f"Матч между {home_team} и {away_team} продолжается. "
            formatted += f"Следите за обновлениями и результатами в реальном времени!"
            formatted += f"</blockquote>\n\n"
        
        # Хештеги
        formatted += "\n"
        formatted += "#футбол #матч #LUXON"
        if league:
            league_tag = league.replace(' ', '').replace('-', '').lower()
            formatted += f" #{league_tag}"
        if country:
            country_tag = country.replace(' ', '').lower()
            formatted += f" #{country_tag}"
        
        return formatted
    
    def _format_predictions(self, home_team: str, away_team: str, predictions: Dict, league: str = "") -> str:
        """Форматирует прогнозы с коэффициентами и вероятностями"""
        formatted = ""
        
        probabilities = predictions.get('probabilities')
        odds = predictions.get('odds')
        
        # Используем вероятности если есть
        if probabilities:
            try:
                home_prob = probabilities.get('event_HW', '')
                draw_prob = probabilities.get('event_D', '')
                away_prob = probabilities.get('event_AW', '')
                
                if home_prob or draw_prob or away_prob:
                    formatted += "<b>🎯 Вероятности исходов:</b>\n\n"
                    formatted += f"🏠 <b>{home_team}</b>: {home_prob}%\n" if home_prob else ""
                    formatted += f"⚖️ <b>Ничья</b>: {draw_prob}%\n" if draw_prob else ""
                    formatted += f"✈️ <b>{away_team}</b>: {away_prob}%\n" if away_prob else ""
                    formatted += "\n"
                    
                    # Определяем фаворита
                    try:
                        home_p = float(home_prob) if home_prob else 0
                        draw_p = float(draw_prob) if draw_prob else 0
                        away_p = float(away_prob) if away_prob else 0
                        
                        max_prob = max(home_p, draw_p, away_p)
                        if max_prob == home_p and home_p > 0:
                            favorite = f"🏠 {home_team}"
                        elif max_prob == away_p and away_p > 0:
                            favorite = f"✈️ {away_team}"
                        else:
                            favorite = "⚖️ Ничья"
                        
                        formatted += f"⭐ <b>Фаворит:</b> {favorite} ({max_prob:.1f}%)\n\n"
                    except:
                        pass
            except Exception as e:
                logger.warning(f"Ошибка форматирования вероятностей: {e}")
        
        # Используем коэффициенты букмекеров если есть
        if odds:
            try:
                # odds может быть словарем с ключами - ID матчей
                # Берем первый доступный матч
                match_odds = None
                if isinstance(odds, dict):
                    # Ищем первый непустой элемент
                    for key, value in odds.items():
                        if isinstance(value, list) and len(value) > 0:
                            match_odds = value[0]  # Берем первую букмекерскую контору
                            break
                
                if match_odds and isinstance(match_odds, dict):
                    bookmaker = match_odds.get('odd_bookmakers', 'Букмекер')
                    odd_1 = match_odds.get('odd_1', '')  # Победа хозяев
                    odd_x = match_odds.get('odd_x', '')  # Ничья
                    odd_2 = match_odds.get('odd_2', '')  # Победа гостей
                    
                    if odd_1 or odd_x or odd_2:
                        formatted += f"<b>💰 Коэффициенты ({bookmaker}):</b>\n\n"
                        formatted += f"🏠 <b>{home_team}</b>: {odd_1}\n" if odd_1 else ""
                        formatted += f"⚖️ <b>Ничья</b>: {odd_x}\n" if odd_x else ""
                        formatted += f"✈️ <b>{away_team}</b>: {odd_2}\n" if odd_2 else ""
                        formatted += "\n"
                        
                        # Рекомендация на основе коэффициентов
                        try:
                            if odd_1 and odd_x and odd_2:
                                odd_1_f = float(odd_1)
                                odd_x_f = float(odd_x)
                                odd_2_f = float(odd_2)
                                
                                # Находим наименьший коэффициент (фаворит)
                                min_odd = min(odd_1_f, odd_x_f, odd_2_f)
                                if min_odd == odd_1_f:
                                    recommendation = f"🏠 Победа {home_team}"
                                    recommendation_odd = odd_1
                                elif min_odd == odd_2_f:
                                    recommendation = f"✈️ Победа {away_team}"
                                    recommendation_odd = odd_2
                                else:
                                    recommendation = "⚖️ Ничья"
                                    recommendation_odd = odd_x
                                
                                formatted += f"💡 <b>Рекомендация:</b> {recommendation} (коэф. {recommendation_odd})\n\n"
                        except:
                            pass
            except Exception as e:
                logger.warning(f"Ошибка форматирования коэффициентов: {e}")
        
        # Если нет данных, добавляем общий прогноз
        if not formatted:
            formatted += "<blockquote>"
            formatted += f"Ожидается интересный матч между {home_team} и {away_team}. "
            formatted += f"Обе команды готовятся к важной встрече в рамках {league if league else 'турнира'}. "
            formatted += f"Следите за трансляцией и результатами матча!"
            formatted += "</blockquote>\n\n"
        else:
            # Добавляем предупреждение
            formatted += "<i>⚠️ Прогнозы основаны на статистике и коэффициентах букмекеров. Не является финансовой рекомендацией.</i>\n\n"
        
        return formatted
    
    def _format_match_news_sync(self, news_item: Dict) -> str:
        """Синхронная версия форматирования матча (без прогнозов, используется как fallback)"""
        event_data = news_item.get('event_data', {})
        title = news_item.get('title', '')
        
        home_team = event_data.get('event_home_team', '')
        away_team = event_data.get('event_away_team', '')
        league = event_data.get('league_name', '')
        
        formatted = f"⚽ <b>{title}</b>\n\n"
        formatted += f"<b>📋 Детали матча:</b>\n\n"
        formatted += f"🏠 <b>Хозяева:</b> {home_team}\n"
        formatted += f"✈️ <b>Гости:</b> {away_team}\n"
        if league:
            formatted += f"🏆 <b>Лига:</b> {league}\n"
        formatted += "\n"
        formatted += "<b>📈 Прогноз:</b>\n\n"
        formatted += f"<blockquote>Ожидается интересный матч между {home_team} и {away_team}.</blockquote>\n\n"
        formatted += "#футбол #матч #LUXON"
        return formatted
    
    def _format_simple(self, news_item: Dict) -> str:
        """Простое форматирование без AI"""
        title = news_item.get('title', '')
        description = news_item.get('description', '')
        content = news_item.get('content', description)
        source = news_item.get('source', '')
        
        # Если это матч из AllSportsAPI, используем простую синхронную версию
        if source == 'AllSportsAPI' and news_item.get('event_data'):
            return self._format_match_news_sync(news_item)
        
        formatted = f"⚽ <b>{title}</b>\n\n"
        
        if content:
            # Берем первые 500 символов
            text = content[:500]
            if len(content) > 500:
                text += "..."
            formatted += f"{text}\n\n"
        
        formatted += "📊 <i>Прогноз:</i> Следите за развитием событий!\n\n"
        formatted += "#футбол #новости #LUXON"
        
        return formatted

