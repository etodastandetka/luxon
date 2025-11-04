# Исправление ошибки JDBC на Android

## Проблема

При попытке использовать прямое подключение к PostgreSQL через JDBC драйвер возникла ошибка:
```
java.lang.ClassNotFoundException: Didn't find class "java.lang.management.ManagementFactory"
```

## Причина

PostgreSQL JDBC драйвер использует Java Management Extensions (JMX), которые недоступны в Android Runtime (ART). Классы из пакета `java.lang.management` существуют только в полноценной JVM, но не в Android.

## Решение

Вернулись к использованию **HTTP API** через PHP скрипт вместо прямого JDBC подключения.

### Изменения:

1. ✅ **Удалена зависимость JDBC драйвера** из `build.gradle`
2. ✅ **Заменен `PostgresDirectClient` на `PostgresApiClient`** в `NotificationReaderService`
3. ✅ **Вернут `minSdk 24`** (было повышено до 26 для JDBC)
4. ✅ **Добавлено логирование** всех операций с PostgreSQL через HTTP API

## Текущая архитектура:

```
Android App → HTTP POST → PHP Script (api.php) → PostgreSQL Database
```

### Преимущества HTTP API:

- ✅ Работает на всех версиях Android (minSdk 24+)
- ✅ Не требует специальных библиотек JDBC
- ✅ Более безопасно (учетные данные на сервере)
- ✅ Легче отлаживать и логировать
- ✅ Стабильно работает

### Конфигурация:

- **API Endpoint:** `http://89.23.117.61/api/payments.php`
- **Метод:** POST
- **Формат:** JSON
- **Настройка:** `DatabaseConfig.API_BASE_URL`

## Логирование

Все операции с PostgreSQL теперь логируются:
- Успешные отправки → `SUCCESS` уровень
- Ошибки HTTP → `ERROR` уровень  
- Детали ошибок сохраняются со stack trace

Можно просматривать все логи в разделе "Логи" приложения.

