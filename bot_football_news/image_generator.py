"""
Модуль для генерации изображений на основе новостей
"""
import logging
import os
import httpx
import base64
import asyncio
from typing import Optional
from config import (
    AI_IMAGE_SERVICE,
    HUGGINGFACE_API_KEY,
    HUGGINGFACE_IMAGE_MODEL,
    FUSIONBRAIN_API_KEY,
    FUSIONBRAIN_SECRET_KEY,
    REPLICATE_API_TOKEN,
    STABILITYAI_API_KEY
)

logger = logging.getLogger(__name__)

# Пробуем импортировать huggingface_hub для более надежной работы
try:
    from huggingface_hub import InferenceClient
    HAS_HF_HUB = True
except ImportError:
    HAS_HF_HUB = False
    logger.warning("huggingface_hub не установлен, используем прямой HTTP API")


class ImageGenerator:
    def __init__(self, images_dir: str = "images"):
        self.images_dir = images_dir
        self.service = AI_IMAGE_SERVICE
        os.makedirs(images_dir, exist_ok=True)
    
    async def generate_image(self, news_title: str, news_id: str, news_description: str = None) -> Optional[str]:
        """Генерирует изображение на основе заголовка и описания новости"""
        logger.info(f"Генерация изображения. Сервис: {self.service}")
        
        if self.service == "none":
            logger.warning("Сервис генерации изображений установлен в 'none'")
            return None
        
        # Создаем промпт для генерации с описанием
        prompt = self._create_prompt(news_title, news_description)
        logger.info(f"Промпт для генерации: {prompt[:100]}...")
        
        try:
            if self.service == "craiyon":
                logger.info("Используем Craiyon для генерации изображения")
                image_path = await self._generate_craiyon(prompt, news_id)
            elif self.service == "stabilityai":
                logger.info("Используем Stability AI для генерации изображения")
                image_path = await self._generate_stabilityai(prompt, news_id)
            elif self.service == "huggingface":
                logger.info("Используем Hugging Face для генерации изображения")
                image_path = await self._generate_huggingface(prompt, news_id)
            elif self.service == "fusionbrain":
                logger.info("Используем FusionBrain для генерации изображения")
                image_path = await self._generate_fusionbrain(prompt, news_id)
            elif self.service == "replicate":
                logger.info("Используем Replicate для генерации изображения")
                image_path = await self._generate_replicate(prompt, news_id)
            else:
                logger.warning(f"Неизвестный сервис генерации изображений: {self.service}")
                return None
            
            if image_path:
                logger.info(f"✅ Изображение успешно сгенерировано: {image_path}")
            else:
                logger.warning("⚠️ Генерация изображения вернула None")
            
            return image_path
        except Exception as e:
            logger.error(f"Ошибка генерации изображения: {e}", exc_info=True)
            return None
    
    def _create_prompt(self, title: str, description: str = None) -> str:
        """Создает промпт для генерации изображения на основе заголовка и описания"""
        # Базовый промпт с контекстом футбола
        prompt_parts = ["футбольная новость", "профессиональный футбол"]
        
        # Добавляем информацию из заголовка
        title_clean = title.lower()
        # Убираем технические детали из заголовка
        title_clean = title_clean.replace("vs", "против").replace(":", " ")
        prompt_parts.append(title_clean)
        
        # Добавляем описание если есть
        if description:
            # Берем ключевые слова из описания
            desc_clean = description.lower()[:100]  # Ограничиваем длину
            prompt_parts.append(desc_clean)
        
        # Добавляем стилистические элементы
        prompt_parts.extend([
            "стадион",
            "динамичная композиция",
            "яркие цвета",
            "спортивная фотография",
            "высокое качество",
            "профессиональное освещение"
        ])
        
        prompt = ", ".join(prompt_parts)
        return prompt[:300]  # Ограничиваем длину
    
    async def _generate_huggingface(self, prompt: str, news_id: str) -> Optional[str]:
        """Генерация через Hugging Face API"""
        if not HUGGINGFACE_API_KEY:
            logger.warning("Hugging Face API ключ не установлен")
            return None
        
        # Пробуем разные варианты endpoints и форматов
        # Проблема: старый API не работает (410), Router API требует специальных прав
        # Решение: пробуем разные форматы запросов
        
        endpoints_to_try = [
            # Вариант 1: Router API через hf-inference с правильным форматом
            (f"https://router.huggingface.co/hf-inference/v1/images/generations", {
                "model": HUGGINGFACE_IMAGE_MODEL,
                "prompt": prompt,
                "num_inference_steps": 20,
                "guidance_scale": 7.5,
                "width": 512,
                "height": 512
            }),
            # Вариант 2: Router API через прямой endpoint с форматом inputs
            (f"https://router.huggingface.co/models/{HUGGINGFACE_IMAGE_MODEL}", {
                "inputs": prompt,
                "parameters": {
                    "num_inference_steps": 20,
                    "guidance_scale": 7.5
                }
            }),
            # Вариант 3: Пробуем через Inference API напрямую (может быть переадресован)
            (f"https://api-inference.huggingface.co/models/{HUGGINGFACE_IMAGE_MODEL}", {
                "inputs": prompt,
                "parameters": {
                    "num_inference_steps": 20,
                    "guidance_scale": 7.5
                }
            }),
        ]
        
        try:
            async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
                for url, json_data in endpoints_to_try:
                    logger.info(f"Пробуем endpoint: {url}")
                    
                    response = await client.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json=json_data
                    )
                    
                    logger.info(f"Ответ: {response.status_code}")
                    
                    # Если 410, 403 или 404, пробуем следующий endpoint
                    if response.status_code in [410, 403, 404]:
                        error_text = response.text[:200] if hasattr(response, 'text') else ""
                        logger.warning(f"Endpoint {url} вернул {response.status_code}: {error_text}, пробуем следующий...")
                        continue
                    
                    # Если модель загружается, ждем
                    if response.status_code == 503:
                        logger.info("Модель загружается, ожидание 20 секунд...")
                        await asyncio.sleep(20)
                        response = await client.post(
                            url,
                            headers={
                                "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
                                "Content-Type": "application/json"
                            },
                            json=json_data
                        )
                        logger.info(f"Повторный ответ: {response.status_code}")
                    
                    if response.status_code == 200:
                        # Проверяем тип ответа
                        content_type = response.headers.get("content-type", "").lower()
                        
                        # Пробуем разные форматы ответа
                        image_data = None
                        
                        # Вариант 1: Бинарные данные (PNG/JPEG напрямую)
                        if "image" in content_type or response.content[:4] == b'\x89PNG' or response.content[:2] == b'\xff\xd8':
                            image_data = response.content
                            logger.info("Получено бинарное изображение")
                        else:
                            # Вариант 2: JSON ответ
                            try:
                                result = response.json()
                                logger.info(f"JSON ответ получен: {type(result)}")
                                
                                if isinstance(result, dict):
                                    if "b64_json" in result:
                                        image_data = base64.b64decode(result["b64_json"])
                                    elif "url" in result:
                                        # Скачиваем изображение по URL
                                        img_response = await client.get(result["url"])
                                        image_data = img_response.content
                                    elif "image" in result:
                                        if isinstance(result["image"], str):
                                            image_data = base64.b64decode(result["image"])
                                        else:
                                            image_data = result["image"]
                                    else:
                                        logger.warning(f"Неожиданный JSON формат: {list(result.keys())[:5]}")
                                elif isinstance(result, list) and len(result) > 0:
                                    if isinstance(result[0], dict) and "b64_json" in result[0]:
                                        image_data = base64.b64decode(result[0]["b64_json"])
                                    elif isinstance(result[0], str):
                                        image_data = base64.b64decode(result[0])
                                    else:
                                        logger.warning(f"Неожиданный формат массива")
                                else:
                                    logger.warning(f"Неожиданный формат ответа: {type(result)}")
                            except Exception as e:
                                logger.warning(f"Ошибка парсинга JSON: {e}")
                                # Пробуем как бинарные данные
                                image_data = response.content
                        
                        if image_data:
                            # Сохраняем изображение
                            image_path = os.path.join(self.images_dir, f"{news_id}.png")
                            with open(image_path, 'wb') as f:
                                f.write(image_data)
                            logger.info(f"✅ Изображение сохранено: {image_path}")
                            return image_path
                        else:
                            logger.warning("Не удалось извлечь изображение из ответа")
                            continue  # Пробуем следующий endpoint
                    
                    # Если не 200, пробуем следующий endpoint
                    else:
                        error_text = response.text[:300] if hasattr(response, 'text') else str(response.status_code)
                        logger.warning(f"Ошибка {response.status_code}: {error_text}, пробуем следующий endpoint...")
                        continue
                
                # Если все endpoints не сработали
                logger.error("❌ Все endpoints вернули ошибку")
                logger.error("💡 Возможные причины:")
                logger.error("   1. Токен не имеет прав 'Make calls to Inference Providers'")
                logger.error("   2. Модель недоступна через Inference API")
                logger.error("   3. Router API требует платной подписки или специальных прав")
                logger.error("💡 Решение: Используйте другой сервис (FusionBrain, Replicate) или отключите генерацию изображений")
                return None
        except Exception as e:
            logger.error(f"Ошибка Hugging Face генерации: {e}", exc_info=True)
            return None
    
    async def _generate_fusionbrain(self, prompt: str, news_id: str) -> Optional[str]:
        """Генерация через FusionBrain (Kandinsky)"""
        if not FUSIONBRAIN_API_KEY or not FUSIONBRAIN_SECRET_KEY:
            logger.warning("FusionBrain credentials не установлены")
            return None
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Получаем токен
                auth_response = await client.post(
                    "https://api-key.fusionbrain.ai/key/api/v1/login",
                    json={
                        "api_key": FUSIONBRAIN_API_KEY,
                        "secret_key": FUSIONBRAIN_SECRET_KEY
                    }
                )
                
                if auth_response.status_code != 200:
                    logger.error(f"FusionBrain auth ошибка: {auth_response.status_code}")
                    return None
                
                token = auth_response.json().get('token')
                if not token:
                    return None
                
                # Генерируем изображение
                generate_response = await client.post(
                    "https://api-key.fusionbrain.ai/key/api/v1/text2image/run",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "type": "GENERATE",
                        "style": "DEFAULT",
                        "width": 1024,
                        "height": 1024,
                        "numImages": 1,
                        "generateParams": {
                            "query": prompt
                        }
                    }
                )
                
                if generate_response.status_code == 200:
                    task_id = generate_response.json().get('uuid')
                    if not task_id:
                        return None
                    
                    # Ждем готовности изображения
                    for _ in range(30):  # Максимум 30 попыток
                        await asyncio.sleep(2)
                        check_response = await client.get(
                            f"https://api-key.fusionbrain.ai/key/api/v1/text2image/status/{task_id}",
                            headers={"Authorization": f"Bearer {token}"}
                        )
                        
                        if check_response.status_code == 200:
                            status = check_response.json()
                            if status.get('status') == 'DONE':
                                image_base64 = status.get('images', [None])[0]
                                if image_base64:
                                    image_data = base64.b64decode(image_base64)
                                    image_path = os.path.join(self.images_dir, f"{news_id}.png")
                                    with open(image_path, 'wb') as f:
                                        f.write(image_data)
                                    return image_path
                            elif status.get('status') == 'FAIL':
                                logger.error("FusionBrain генерация не удалась")
                                return None
                    
                    logger.error("FusionBrain таймаут генерации")
                    return None
                else:
                    logger.error(f"FusionBrain генерация ошибка: {generate_response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Ошибка FusionBrain генерации: {e}")
            return None
    
    async def _generate_replicate(self, prompt: str, news_id: str) -> Optional[str]:
        """Генерация через Replicate API"""
        if not REPLICATE_API_TOKEN:
            logger.warning("Replicate API токен не установлен")
            return None
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.replicate.com/v1/predictions",
                    headers={
                        "Authorization": f"Token {REPLICATE_API_TOKEN}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "version": "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
                        "input": {
                            "prompt": prompt,
                            "num_outputs": 1,
                            "guidance_scale": 7.5,
                            "num_inference_steps": 20
                        }
                    }
                )
                
                if response.status_code == 201:
                    prediction = response.json()
                    prediction_id = prediction.get('id')
                    
                    # Ждем готовности
                    for _ in range(30):
                        await asyncio.sleep(2)
                        status_response = await client.get(
                            f"https://api.replicate.com/v1/predictions/{prediction_id}",
                            headers={"Authorization": f"Token {REPLICATE_API_TOKEN}"}
                        )
                        
                        if status_response.status_code == 200:
                            status_data = status_response.json()
                            if status_data.get('status') == 'succeeded':
                                image_url = status_data.get('output', [None])[0]
                                if image_url:
                                    # Скачиваем изображение
                                    img_response = await client.get(image_url)
                                    if img_response.status_code == 200:
                                        image_path = os.path.join(self.images_dir, f"{news_id}.png")
                                        with open(image_path, 'wb') as f:
                                            f.write(img_response.content)
                                        return image_path
                            elif status_data.get('status') == 'failed':
                                logger.error("Replicate генерация не удалась")
                                return None
                    
                    logger.error("Replicate таймаут генерации")
                    return None
                else:
                    logger.error(f"Replicate генерация ошибка: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Ошибка Replicate генерации: {e}")
            return None
    
    async def _generate_craiyon(self, prompt: str, news_id: str) -> Optional[str]:
        """Генерация через Craiyon API (полностью бесплатный, без регистрации)"""
        try:
            async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as client:
                logger.info("Отправляем запрос в Craiyon...")
                
                # Пробуем разные варианты Craiyon API
                endpoints_to_try = [
                    # Вариант 1: Новый endpoint
                    ("https://api.craiyon.com/v3", {
                        "prompt": prompt,
                        "model": "art",
                        "negative_prompt": "blurry, low quality, distorted",
                        "num_images": 1
                    }),
                    # Вариант 2: Старый формат
                    ("https://api.craiyon.com/v3", {
                        "prompt": prompt,
                        "token": None,
                        "model": "art",
                        "negative_prompt": "blurry, low quality, distorted",
                        "num_images": 1
                    }),
                    # Вариант 3: Без некоторых параметров
                    ("https://api.craiyon.com/v3", {
                        "prompt": prompt,
                        "model": "art"
                    }),
                ]
                
                for url, json_data in endpoints_to_try:
                    try:
                        response = await client.post(
                            url,
                            json=json_data,
                            headers={
                                "Content-Type": "application/json",
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                                "Accept": "application/json",
                                "Origin": "https://www.craiyon.com",
                                "Referer": "https://www.craiyon.com/"
                            }
                        )
                
                logger.info(f"Craiyon ответ: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Craiyon возвращает base64 изображения в массиве images
                    if "images" in result and len(result["images"]) > 0:
                        image_base64 = result["images"][0]
                        image_data = base64.b64decode(image_base64)
                        
                        image_path = os.path.join(self.images_dir, f"{news_id}.png")
                        with open(image_path, 'wb') as f:
                            f.write(image_data)
                        logger.info(f"✅ Изображение сохранено через Craiyon: {image_path}")
                        return image_path
                    else:
                        logger.warning("Craiyon не вернул изображения")
                        return None
                else:
                    error_text = response.text[:300] if hasattr(response, 'text') else str(response.status_code)
                    logger.error(f"❌ Craiyon ошибка: {response.status_code} - {error_text}")
                    return None
        except Exception as e:
            logger.error(f"Ошибка Craiyon генерации: {e}", exc_info=True)
            return None
    
    async def _generate_stabilityai(self, prompt: str, news_id: str) -> Optional[str]:
        """Генерация через Stability AI API (бесплатный tier доступен)"""
        if not STABILITYAI_API_KEY:
            logger.warning("Stability AI API ключ не установлен")
            return None
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                logger.info("Отправляем запрос в Stability AI...")
                
                # Stability AI API endpoint
                response = await client.post(
                    "https://api.stability.ai/v2beta/stable-image/generate/core",
                    headers={
                        "Authorization": f"Bearer {STABILITYAI_API_KEY}",
                        "Content-Type": "application/json",
                        "Accept": "image/png"
                    },
                    json={
                        "prompt": prompt,
                        "output_format": "png",
                        "aspect_ratio": "1:1",
                        "seed": 0,
                        "mode": "text-to-image"
                    }
                )
                
                logger.info(f"Stability AI ответ: {response.status_code}")
                
                if response.status_code == 200:
                    # Stability AI возвращает бинарные данные изображения
                    image_data = response.content
                    
                    image_path = os.path.join(self.images_dir, f"{news_id}.png")
                    with open(image_path, 'wb') as f:
                        f.write(image_data)
                    logger.info(f"✅ Изображение сохранено через Stability AI: {image_path}")
                    return image_path
                else:
                    error_text = response.text[:300] if hasattr(response, 'text') else str(response.status_code)
                    logger.error(f"❌ Stability AI ошибка: {response.status_code} - {error_text}")
                    return None
        except Exception as e:
            logger.error(f"Ошибка Stability AI генерации: {e}", exc_info=True)
            return None

