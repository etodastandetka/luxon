# Настройка SSL сертификатов для nginx

## Быстрая установка

На сервере выполните:

```bash
cd /var/www/luxon
git pull
cd nginx
chmod +x setup_ssl.sh
sudo ./setup_ssl.sh
```

## Ручная установка

### 1. Установка certbot

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

### 2. Копирование конфигураций nginx

```bash
cd /var/www/luxon
sudo cp nginx/lux-on.org.conf /etc/nginx/sites-available/lux-on.org
sudo cp nginx/pipiska.net.conf /etc/nginx/sites-available/pipiska.net

# Включаем сайты
sudo ln -s /etc/nginx/sites-available/lux-on.org /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/pipiska.net /etc/nginx/sites-enabled/
```

### 3. Создание директории для ACME challenge

```bash
sudo mkdir -p /var/www/html/.well-known/acme-challenge
```

### 4. Проверка конфигурации nginx

```bash
sudo nginx -t
```

Если ошибок нет, перезапустите nginx:

```bash
sudo systemctl restart nginx
```

### 5. Получение SSL сертификатов

Для lux-on.org:
```bash
sudo certbot --nginx -d lux-on.org -d www.lux-on.org
```

Для pipiska.net:
```bash
sudo certbot --nginx -d pipiska.net -d www.pipiska.net
```

Certbot автоматически:
- Получит сертификаты
- Обновит конфигурацию nginx
- Настроит автообновление

### 6. Проверка статуса сертификатов

```bash
sudo certbot certificates
```

## Автообновление сертификатов

Certbot автоматически создает cron задачу для обновления сертификатов. 
Проверить можно:

```bash
sudo systemctl status certbot.timer
```

Или добавить вручную в crontab:

```bash
sudo crontab -e
```

Добавить строку:
```
0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'
```

## Проверка работы

После установки SSL:

1. Проверьте HTTPS:
   - https://lux-on.org
   - https://pipiska.net

2. Проверьте редирект с HTTP на HTTPS:
   - http://lux-on.org (должен редиректить на https://lux-on.org)

3. Проверьте SSL сертификат:
   ```bash
   openssl s_client -connect lux-on.org:443 -servername lux-on.org
   ```

## Возможные проблемы

### 1. Certbot не может получить сертификат

**Причина**: Домены не указывают на IP сервера или порт 80 закрыт.

**Решение**:
- Проверьте DNS записи: `dig lux-on.org` или `nslookup lux-on.org`
- Убедитесь, что порт 80 открыт: `sudo ufw allow 80/tcp`
- Проверьте, что nginx запущен: `sudo systemctl status nginx`

### 2. Ошибка "nginx: configuration file /etc/nginx/nginx.conf test failed"

**Причина**: Ошибка в конфигурации nginx.

**Решение**:
- Проверьте синтаксис: `sudo nginx -t`
- Проверьте пути к сертификатам в конфигурации
- Убедитесь, что сертификаты существуют: `ls -la /etc/letsencrypt/live/lux-on.org/`

### 3. Cloudflare 521 ошибка

**Причина**: Cloudflare не может подключиться к origin серверу.

**Решение**:
- Убедитесь, что приложение запущено: `pm2 status`
- Проверьте порты: `sudo netstat -tlnp | grep :3030` (для lux-on.org) или `:3001` (для pipiska.net)
- Проверьте логи nginx: `sudo tail -f /var/log/nginx/lux-on.org.error.log`
- Убедитесь, что Cloudflare настроен на "Full (strict)" или "Full" SSL режим

### 4. Сертификаты не обновляются автоматически

**Решение**:
```bash
# Проверьте статус таймера
sudo systemctl status certbot.timer

# Включите таймер
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Или обновите вручную
sudo certbot renew --dry-run
```

## Настройка Cloudflare

Если используется Cloudflare:

1. **SSL/TLS режим**: Установите "Full (strict)" или "Full"
   - "Full (strict)": Cloudflare ожидает валидный SSL сертификат на origin сервере
   - "Full": Cloudflare принимает самоподписанные сертификаты

2. **Always Use HTTPS**: Включите в настройках SSL/TLS

3. **Minimum TLS Version**: TLS 1.2 или выше

4. **HTTP Strict Transport Security (HSTS)**: Рекомендуется включить

