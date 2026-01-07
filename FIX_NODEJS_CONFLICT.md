# Исправление конфликта nodejs и npm

## Проблема:
Конфликт между `nodejs` и `npm` при установке через apt-get.

## Решение:

Node.js из NodeSource уже включает npm, поэтому не нужно устанавливать npm отдельно.

### На сервере выполните:

```bash
cd /var/www/luxon

# Обновите репозиторий
git pull

# Если nodejs уже установлен из NodeSource, npm уже должен быть там
node -v
npm -v

# Если npm нет, установите nodejs заново:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Проверьте
npm -v

# Теперь запустите скрипт
bash setup_server_on_remote.sh
```

### Или выполните вручную без npm в apt-get:

```bash
# Установите пакеты без npm
apt-get install -y curl wget git nginx certbot python3-certbot-nginx python3 python3-pip python3-venv build-essential postgresql-client

# Установите Node.js из NodeSource (npm идет вместе с nodejs)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Проверьте что npm работает
npm -v
```

