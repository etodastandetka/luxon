# Использование скрипта управления админами на сервере

## Быстрый старт

### 1. Настройка виртуального окружения (рекомендуется)

```bash
cd /var/www/luxon/admin_nextjs
chmod +x scripts/setup-admin-venv.sh
./scripts/setup-admin-venv.sh
```

Этот скрипт:
- Создаст виртуальное окружение в `scripts/venv/`
- Установит все необходимые зависимости
- Готово к использованию!

### 2. Альтернатива: установка глобально (не рекомендуется)

```bash
cd /var/www/luxon/admin_nextjs
pip3 install -r scripts/requirements-admin.txt
```

Или установите вручную:
```bash
pip3 install psycopg2-binary bcrypt pyotp qrcode[pil] qrcode-terminal
```

### 2. Использование

**Способ 1: Через обертку (рекомендуется)**
```bash
cd /var/www/luxon/admin_nextjs
chmod +x scripts/run-admin-script.sh
./scripts/run-admin-script.sh <command>
```

**Способ 2: С активацией venv вручную**
```bash
cd /var/www/luxon/admin_nextjs
source scripts/venv/bin/activate
python3 scripts/manage_admins.py <command>
deactivate
```

**Способ 3: Без venv (если зависимости установлены глобально)**
```bash
cd /var/www/luxon/admin_nextjs
python3 scripts/manage_admins.py <command>
```

## Примеры команд

### Создать админа
```bash
./scripts/run-admin-script.sh create dastan password123 dastan@luxon.com
```

### Создать супер-админа
```bash
./scripts/run-admin-script.sh create admin password123 --super
```

### Показать список админов
```bash
./scripts/run-admin-script.sh list
```

### Получить QR-код для 2FA
```bash
./scripts/run-admin-script.sh 2fa dastan
```

### Удалить админа
```bash
./scripts/run-admin-script.sh delete oldadmin
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

