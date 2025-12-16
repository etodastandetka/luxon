# Быстрый старт для MobCash Python скрипта

## 1. Обновите код на сервере

```bash
cd /var/www/luxon/admin_nextjs
git pull origin main
```

## 2. Создайте виртуальное окружение

```bash
cd /var/www/luxon/admin_nextjs
python3 -m venv venv
source venv/bin/activate
pip install requests
```

## 3. Настройте переменные окружения

Убедитесь, что в `.env` файле есть:
```env
MOBCASH_LOGIN=ваш_логин
MOBCASH_PASSWORD=ваш_пароль
MOBCASH_CASHDESK_ID=1001098
MOBCASH_DEFAULT_LAT=42.845778
MOBCASH_DEFAULT_LON=74.568778
```

## 4. Запустите скрипт

```bash
cd /var/www/luxon/admin_nextjs
source venv/bin/activate
python3 scripts/update_mobcash_tokens.py
```

## 5. Проверьте результат

```bash
python3 scripts/read_mobcash_tokens.py
```

## 6. Настройте автоматическое обновление (cron)

```bash
crontab -e
```

Добавьте:
```
0 */20 * * * cd /var/www/luxon/admin_nextjs && /var/www/luxon/admin_nextjs/venv/bin/python3 scripts/update_mobcash_tokens.py >> /var/log/mobcash_tokens.log 2>&1
```

## Проверка файлов

Если скрипт не найден, проверьте:
```bash
ls -la /var/www/luxon/admin_nextjs/scripts/update_mobcash_tokens.py
ls -la /var/www/luxon/admin_nextjs/scripts/read_mobcash_tokens.py
```

Если файлов нет, выполните:
```bash
cd /var/www/luxon
git pull origin main
```

