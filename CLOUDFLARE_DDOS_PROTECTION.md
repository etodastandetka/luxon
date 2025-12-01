# 🛡️ Защита от DDoS через Cloudflare

## Зачем это нужно?

- ✅ Скрывает реальный IP вашего сервера
- ✅ Защита от DDoS атак (бесплатно)
- ✅ Кэширование статики (ускоряет сайт)
- ✅ SSL сертификаты (бесплатно)
- ✅ Защита от ботов и спама

## Шаг 1: Регистрация в Cloudflare

1. Зайдите на https://dash.cloudflare.com/sign-up
2. Зарегистрируйтесь (бесплатно)
3. Добавьте ваш домен: `japar.click` и `luxon.dad`

## Шаг 2: Настройка DNS в Cloudflare

### Для japar.click:

1. В Cloudflare Dashboard выберите домен `japar.click`
2. Перейдите в **DNS → Records**
3. Добавьте записи:

```
Type: A
Name: @
Content: 67.217.228.192
Proxy: 🟠 Proxied (ВКЛЮЧЕНО - важно!)
TTL: Auto

Type: A
Name: www
Content: 67.217.228.192
Proxy: 🟠 Proxied (ВКЛЮЧЕНО - важно!)
TTL: Auto
```

### Для luxon.dad:

То же самое:
```
Type: A
Name: @
Content: 67.217.228.192
Proxy: 🟠 Proxied (ВКЛЮЧЕНО!)

Type: A
Name: www
Content: 67.217.228.192
Proxy: 🟠 Proxied (ВКЛЮЧЕНО!)
```

**⚠️ ВАЖНО:** Обязательно включите **Proxy (🟠 оранжевое облачко)** - это скрывает ваш IP!

## Шаг 3: Изменение Name Servers в Njalla

1. В Cloudflare Dashboard для каждого домена найдите **Name Servers**
   - Обычно что-то вроде:
     - `alex.ns.cloudflare.com`
     - `linda.ns.cloudflare.com`

2. Зайдите в панель Njalla для каждого домена
3. Найдите "Use custom name servers" или "Изменить DNS серверы"
4. Вставьте Name Servers от Cloudflare
5. Сохраните

**Подождите 5-30 минут** для распространения DNS.

## Шаг 4: Настройка Nginx для работы с Cloudflare

Cloudflare будет проксировать трафик, поэтому нужно настроить Nginx для приема только от Cloudflare.

### Обновление конфигурации Nginx

```bash
sudo nano /etc/nginx/sites-available/japar.click
```

Добавьте в начало файла (перед `server {`):

```nginx
# Cloudflare IP ranges (обновляйте периодически)
# Полный список: https://www.cloudflare.com/ips/

# IPv4
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;

# IPv6
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;

real_ip_header CF-Connecting-IP;
```

И обновите блок `server`:

```nginx
server {
    listen 80;
    server_name japar.click www.japar.click;

    # Разрешаем только Cloudflare IP
    allow 173.245.48.0/20;
    allow 103.21.244.0/22;
    allow 103.22.200.0/22;
    allow 103.31.4.0/22;
    allow 141.101.64.0/18;
    allow 108.162.192.0/18;
    allow 190.93.240.0/20;
    allow 188.114.96.0/20;
    allow 197.234.240.0/22;
    allow 198.41.128.0/17;
    allow 162.158.0.0/15;
    allow 104.16.0.0/13;
    allow 104.24.0.0/14;
    allow 172.64.0.0/13;
    allow 131.0.72.0/22;
    deny all;  # Блокируем все остальные IP

    # Логи
    access_log /var/log/nginx/japar.click.access.log;
    error_log /var/log/nginx/japar.click.error.log;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;  # Cloudflare IP
        proxy_cache_bypass $http_upgrade;
    }
}
```

То же самое для `luxon.dad` (порт 3030).

## Шаг 5: SSL через Cloudflare

Cloudflare предоставляет бесплатный SSL сертификат:

1. В Cloudflare Dashboard → **SSL/TLS**
2. Выберите режим: **Full (strict)** или **Full**
3. Cloudflare автоматически получит сертификат

**Или** используйте Let's Encrypt на сервере (Cloudflare будет проксировать HTTPS):

```bash
sudo certbot --nginx -d japar.click -d www.japar.click
sudo certbot --nginx -d luxon.dad -d www.luxon.dad
```

## Шаг 6: Настройка Firewall (дополнительно)

Заблокируйте прямой доступ к серверу по портам 80 и 443:

```bash
# Разрешаем только Cloudflare IP
sudo ufw allow from 173.245.48.0/20 to any port 80
sudo ufw allow from 173.245.48.0/20 to any port 443
# ... добавьте все диапазоны Cloudflare

# Или проще - разрешите только SSH
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
```

## Шаг 7: Проверка работы

1. Проверьте, что сайты доступны через Cloudflare:
   ```bash
   curl -I https://japar.click
   curl -I https://luxon.dad
   ```

2. Проверьте, что реальный IP скрыт:
   - Зайдите на https://www.whatismyip.com/
   - Должен показываться IP Cloudflare, а не ваш сервер

3. Проверьте заголовки:
   ```bash
   curl -I https://japar.click | grep -i "cf-"
   ```
   Должны быть заголовки Cloudflare.

## Дополнительные настройки Cloudflare

### Security → Settings:
- **Security Level**: Medium или High
- **Challenge Passage**: 30 minutes
- **Browser Integrity Check**: ON

### Speed → Optimization:
- **Auto Minify**: Включите для JS, CSS, HTML
- **Brotli**: ON

### Caching:
- **Caching Level**: Standard
- **Browser Cache TTL**: 4 hours

## Обновление IP диапазонов Cloudflare

IP адреса Cloudflare периодически меняются. Обновляйте список:

```bash
# Скачать актуальные IP
curl https://www.cloudflare.com/ips-v4 -o /tmp/cf-ipv4.txt
curl https://www.cloudflare.com/ips-v6 -o /tmp/cf-ipv6.txt

# Или используйте скрипт для автоматического обновления
```

## ⚠️ Важные замечания

1. **Всегда включайте Proxy (🟠)** в DNS записях Cloudflare
2. **Не публикуйте реальный IP** сервера нигде
3. **Обновляйте IP диапазоны Cloudflare** раз в месяц
4. **Используйте Firewall** для дополнительной защиты

## Проблемы?

### Сайт не открывается:
- Проверьте, что Proxy включен в Cloudflare
- Проверьте, что Name Servers изменены в Njalla
- Подождите распространения DNS (до 24 часов)

### Ошибка 502/503:
- Проверьте, что Nginx принимает только Cloudflare IP
- Проверьте логи: `sudo tail -f /var/log/nginx/error.log`

### SSL ошибки:
- В Cloudflare используйте режим "Full" или "Full (strict)"
- Или получите сертификат через certbot на сервере

