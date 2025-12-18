# Использование скрипта управления админами на сервере

## Быстрый старт

### 1. Установка зависимостей

```bash
cd /var/www/luxon/admin_nextjs
pip3 install -r scripts/requirements-admin.txt
```

Или установите вручную:
```bash
pip3 install psycopg2-binary bcrypt pyotp qrcode[pil] qrcode-terminal
```

### 2. Использование

**Важно:** На Linux серверах используйте `python3`:

```bash
cd /var/www/luxon/admin_nextjs
python3 scripts/manage_admins.py <command>
```

## Примеры команд

### Создать админа
```bash
python3 scripts/manage_admins.py create dastan password123 dastan@luxon.com
```

### Создать супер-админа
```bash
python3 scripts/manage_admins.py create admin password123 --super
```

### Показать список админов
```bash
python3 scripts/manage_admins.py list
```

### Получить QR-код для 2FA
```bash
python3 scripts/manage_admins.py 2fa dastan
```

### Удалить админа
```bash
python3 scripts/manage_admins.py delete oldadmin
```

## Проверка установки

Если команда `python3` не найдена:
```bash
which python3
```

Если Python3 не установлен:
```bash
apt-get update
apt-get install python3 python3-pip
```

## Настройка базы данных

Скрипт автоматически читает `.env` файл из корня `admin_nextjs`.

Убедитесь, что в `/var/www/luxon/admin_nextjs/.env` есть:
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

