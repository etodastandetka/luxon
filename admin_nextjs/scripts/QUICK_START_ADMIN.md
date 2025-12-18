# Быстрый старт: Управление админами

## Установка зависимостей

```bash
cd admin_nextjs/scripts
pip install -r requirements-admin.txt
```

## Основные команды

**Важно:** На Linux используйте `python3` вместо `python`

### 1. Создать админа
```bash
python3 scripts/manage_admins.py create username password email@example.com
```

### 2. Создать супер-админа
```bash
python3 scripts/manage_admins.py create username password email@example.com --super
```

### 3. Показать список админов
```bash
python3 scripts/manage_admins.py list
```

### 4. Удалить админа
```bash
python3 scripts/manage_admins.py delete username
```

### 5. Получить QR-код для 2FA
```bash
python3 scripts/manage_admins.py 2fa username
```

## Примеры

```bash
# Создать обычного админа
python3 scripts/manage_admins.py create admin1 password123 admin1@luxon.com

# Создать супер-админа
python3 scripts/manage_admins.py create superadmin secret456 --super

# Посмотреть всех админов
python3 scripts/manage_admins.py list

# Получить QR-код для 2FA
python3 scripts/manage_admins.py 2fa admin1

# Удалить админа
python3 scripts/manage_admins.py delete admin1
```

## Требования

- Python 3.7+
- Доступ к базе данных PostgreSQL
- Файл `.env` с настройками DATABASE_URL



