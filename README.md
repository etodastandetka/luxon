# Lux Service – Deployment Guide (Django + Next.js WebApp)

This guide explains how to deploy the project on the domain `luxservice.online` with HTTPS (Certbot), run processes via PM2, and configure environment variables for both Django (API) and Next.js (referral mini‑app).

## Components
- **Django admin/API** (folder: `django_admin/`) – serves referral APIs and admin.
- **Telegram Bot** (folder: `bot/`) – uses SQLite `universal_bot.db` to store data.
- **Referral site (Next.js WebApp)** (folder: `referral_site/`) – mini‑app opened inside Telegram, auto‑detects user_id.

## Server prerequisites
- Ubuntu 22.04+ (or similar Linux)
- nginx
- Python 3.10+ (with venv)
- Node.js 18+ and npm
- PM2 (`npm i -g pm2`)
- Certbot (`sudo snap install --classic certbot`)

## 1) Pull code
```bash
cd /opt
sudo git clone https://github.com/etodastandetka/LDDD.git luxservice
sudo chown -R $USER:$USER luxservice
cd luxservice
```

## 2) Python venv + Django deps
```bash
cd django_admin
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt  # если файла нет, установите: django, gunicorn, requests, django-cors-headers
```

If `requirements.txt` is missing, install manually:
```bash
pip install django gunicorn requests django-cors-headers
```

## 3) Environment variables (Django)
Create `.env` or set in `django_admin/settings.py` (prefer `.env` + `python-dotenv`):

```
SITE_BASE_URL=https://luxservice.online
BOT_DATABASE_PATH=/opt/luxservice/universal_bot.db
BOT_TOKEN=<TELEGRAM_BOT_TOKEN>
ALLOWED_HOSTS=luxservice.online,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://luxservice.online
```

Migrate DB and create superuser:
```bash
cd /opt/luxservice/django_admin
source .venv/bin/activate
python manage.py migrate
python manage.py createsuperuser
```

Optional (collect static if needed):
```bash
python manage.py collectstatic --noinput
```

## 4) Next.js (referral_site)
```bash
cd /opt/luxservice/referral_site
npm ci || npm install
cat > .env.local << 'EOF'
NEXT_PUBLIC_DJANGO_BASE=https://luxservice.online
# NEXT_PUBLIC_TG_BOT_USERNAME=<your_bot_username>  # not required in pure WebApp mode
EOF
npm run build
```

## 5) PM2 processes
Create PM2 ecosystem file to run Gunicorn (Django) and Next.js server.

`/opt/luxservice/ecosystem.config.js`:
```js
module.exports = {
  apps: [
    {
      name: 'lux-django',
      cwd: '/opt/luxservice/django_admin',
      script: './.venv/bin/gunicorn',
      args: 'django_admin.wsgi:application --bind 127.0.0.1:8081 --workers 3',
      env: {
        SITE_BASE_URL: 'https://luxservice.online',
        BOT_DATABASE_PATH: '/opt/luxservice/universal_bot.db',
        BOT_TOKEN: '<TELEGRAM_BOT_TOKEN>',
      }
    },
    {
      name: 'lux-next',
      cwd: '/opt/luxservice/referral_site',
      script: 'npm',
      args: 'run start',
      env: {
        NEXT_PUBLIC_DJANGO_BASE: 'https://luxservice.online'
      }
    }
  ]
}
```

Run and persist:
```bash
cd /opt/luxservice
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow instructions (systemd)
```

## 6) nginx reverse proxy
Install nginx and configure two upstreams (Django API at 8081, Next at 3000):

`/etc/nginx/sites-available/luxservice.online`:
```
server {
  listen 80;
  server_name luxservice.online;

  location /.well-known/acme-challenge/ {
    root /var/www/html;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

# Optional separate API host; or keep API under same host as /bot/*
server {
  listen 80;
  server_name api.luxservice.online;

  location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/luxservice.online /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 7) HTTPS via Certbot
Issue certificates for `luxservice.online` (and `api.luxservice.online` if used):
```bash
sudo certbot --nginx -d luxservice.online
# or multiple domains:
# sudo certbot --nginx -d luxservice.online -d api.luxservice.online
```
Certbot installs SSL server blocks automatically and configures renewal.

Check renewal:
```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

## 8) Telegram Bot settings
- In BotFather → Bot Settings → **Menu Button → Web App**: set WebApp URL to `https://luxservice.online`.
- Ensure the domain is allowed in bot settings.
- The mini‑app uses `window.Telegram.WebApp.initDataUnsafe.user.id` to auto‑set `tg_user_id` cookie (component `referral_site/app/layout.tsx` imports `TelegramWebAppAuth`).

## 9) CORS/CSRF
If API and frontend share a host (recommended), CORS is simple. If you split hosts (e.g., `api.luxservice.online`), allow CORS in Django settings:
- `CORS_ALLOWED_ORIGINS=["https://luxservice.online"]`
- Add `django-cors-headers` and middleware accordingly.

## 10) Health check & logs
PM2:
```bash
pm2 status
pm2 logs lux-django --lines 200
pm2 logs lux-next --lines 200
```
nginx:
```bash
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

## 11) Common issues
- 403 push to GitHub: re‑auth with correct account or use SSH.
- GitHub 100MB limit: do not commit large binaries; they were removed from history.
- `node_modules` & builds are ignored via `.gitignore`.
- If Telegram WebApp doesn’t auto‑login: open inside Telegram client, not a browser.

## 12) Update & deploy
```bash
cd /opt/luxservice
git pull
# Rebuild Next if frontend changed
cd referral_site && npm ci && npm run build
# Restart processes
pm2 restart lux-django
pm2 restart lux-next
```

## Paths overview
- Django root: `/opt/luxservice/django_admin/`
- Referral site root: `/opt/luxservice/referral_site/`
- SQLite DB (shared with bot): `/opt/luxservice/universal_bot.db` (configure `BOT_DATABASE_PATH`)

## Notes
- For production harden security headers in nginx and Django.
- Consider moving to PostgreSQL if concurrent write load increases.
- Create swap on small VPS if builds run out of memory.
