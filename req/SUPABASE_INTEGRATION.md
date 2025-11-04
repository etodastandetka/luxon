# Интеграция с Supabase (САМЫЙ ПРОСТОЙ ВАРИАНТ)

## Почему Supabase?
- ✅ Бесплатный план (500MB БД, 2GB bandwidth)
- ✅ Реальный PostgreSQL
- ✅ Автоматический REST API из коробки
- ✅ Не нужно настраивать сервер
- ✅ Готовый SDK для Android

## Шаги настройки:

### 1. Создать проект на Supabase
1. Иди на https://supabase.com
2. Регистрация (можно через GitHub)
3. Создай новый проект
4. Выбери регион (ближе к твоему расположению)

### 2. Получить данные подключения
После создания проекта ты получишь:
- Project URL: `https://xxxxx.supabase.co`
- API Key (anon/public): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Database Password (сохрани его!)

### 3. Импортировать существующую таблицу (опционально)

Если хочешь использовать существующую БД, можно:
- Экспортировать данные из твоей БД
- Импортировать в Supabase через SQL Editor

Или создать таблицу заново через SQL Editor в Supabase Dashboard.

### 4. Настроить Android приложение

Использовать REST API напрямую (без SDK):

```kotlin
// В DatabaseConfig.kt
const val SUPABASE_URL = "https://xxxxx.supabase.co"
const val SUPABASE_API_KEY = "твой_anon_key"

// В PostgresApiClient использовать:
// POST https://xxxxx.supabase.co/rest/v1/payment_notifications
// Headers:
//   apikey: твой_anon_key
//   Authorization: Bearer твой_anon_key
//   Content-Type: application/json
//   Prefer: return=representation
```

---

## Сравнение вариантов:

| Вариант | Сложность | Время настройки | Стоимость |
|---------|-----------|-----------------|-----------|
| Supabase | ⭐ Очень просто | 10 минут | Бесплатно |
| Node.js API | ⭐⭐ Средне | 30 минут | Бесплатно |
| Python Flask | ⭐⭐ Средне | 30 минут | Бесплатно |
| PHP скрипт | ⭐⭐⭐ Сложно | 1-2 часа | Бесплатно |
| Firebase | ⭐ Очень просто | 15 минут | Бесплатно (но не PostgreSQL) |

---

## Рекомендация: Supabase

Если нужен PostgreSQL и быстрый старт - Supabase идеален.

Могу настроить Android приложение для работы с Supabase за 5 минут!

