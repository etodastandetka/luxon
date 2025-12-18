# Скрипт управления админами

Python скрипт для управления администраторами в системе Luxon.

## Установка

1. Установите зависимости:
```bash
pip install -r scripts/requirements-admin.txt
```

Или установите вручную:
```bash
pip install psycopg2-binary bcrypt pyotp qrcode[pil] qrcode-terminal
```

## Настройка

Скрипт автоматически читает переменные окружения из файла `.env` в корне проекта `admin_nextjs`.

Убедитесь, что в `.env` есть:
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

Или отдельные переменные:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=luxon
DB_USER=postgres
DB_PASSWORD=your_password
```

## Использование

### Создание админа

```bash
# Обычный админ
python scripts/manage_admins.py create username password email@example.com

# Супер-админ
python scripts/manage_admins.py create username password email@example.com --super

# Без email
python scripts/manage_admins.py create username password
```

Примеры:
```bash
python scripts/manage_admins.py create admin1 password123 admin1@luxon.com
python scripts/manage_admins.py create superadmin secret456 --super
```

### Удаление админа

```bash
python scripts/manage_admins.py delete username

# Без подтверждения
python scripts/manage_admins.py delete username --yes
```

Пример:
```bash
python scripts/manage_admins.py delete admin1
```

### Просмотр списка админов

```bash
python scripts/manage_admins.py list
```

Выводит таблицу со всеми админами:
- ID
- Username
- Email
- Super Admin (Да/Нет)
- Active (Да/Нет)
- 2FA (Да/Нет)
- Дата создания

### Получение QR-кода для 2FA

```bash
python scripts/manage_admins.py 2fa username
```

Эта команда:
1. Генерирует секрет для 2FA (если его еще нет)
2. Сохраняет секрет в базу данных
3. Генерирует QR-код
4. Отображает QR-код в терминале (ASCII или с помощью qrcode-terminal)
5. Показывает секрет для ручного ввода

Пример:
```bash
python scripts/manage_admins.py 2fa admin1
```

**Важно:** После сканирования QR-кода админ должен подтвердить 2FA через веб-интерфейс админки.

## Структура команд

```
manage_admins.py <command> [arguments] [options]

Команды:
  create    Создать нового админа
  delete    Удалить админа
  list      Показать список всех админов
  2fa       Получить QR-код для 2FA
```

## Примеры полного цикла

### 1. Создание нового админа с 2FA

```bash
# Создаем админа
python scripts/manage_admins.py create newadmin password123 newadmin@luxon.com

# Генерируем QR-код для 2FA
python scripts/manage_admins.py 2fa newadmin

# Админ сканирует QR-код в приложении-аутентификаторе
# Затем подтверждает 2FA через веб-интерфейс
```

### 2. Просмотр всех админов

```bash
python scripts/manage_admins.py list
```

### 3. Удаление неактивного админа

```bash
python scripts/manage_admins.py delete oldadmin
```

## Безопасность

- Пароли хешируются с помощью bcrypt
- Секреты 2FA генерируются с помощью pyotp
- QR-коды содержат otpauth URI для стандартных приложений-аутентификаторов

## Устранение неполадок

### Ошибка подключения к базе данных

Проверьте:
1. Правильность DATABASE_URL в `.env`
2. Доступность базы данных
3. Правильность учетных данных

### QR-код не отображается в терминале

Установите `qrcode-terminal`:
```bash
pip install qrcode-terminal
```

Или используйте ASCII версию (работает всегда).

### Ошибка импорта модулей

Убедитесь, что все зависимости установлены:
```bash
pip install -r scripts/requirements-admin.txt
```

