module.exports = {
  apps: [
    {
      name: 'luxon-django-admin',
      cwd: '/var/www/luxon/django_admin',
      script: 'gunicorn',
      args: 'admin_panel.wsgi:application --bind 127.0.0.1:8081 --workers 3',
      interpreter: 'none',
      env: {
        DJANGO_SETTINGS_MODULE: 'admin_panel.settings'
      },
      error_file: '/var/log/pm2/luxon-django-error.log',
      out_file: '/var/log/pm2/luxon-django-out.log',
      log_file: '/var/log/pm2/luxon-django.log',
      time: true
    },
    {
      name: 'luxon-nextjs',
      cwd: '/var/www/luxon/bot2/mini_app_site',
      script: 'npm',
      args: 'run start:prod',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 3030
      },
      error_file: '/var/log/pm2/luxon-nextjs-error.log',
      out_file: '/var/log/pm2/luxon-nextjs-out.log',
      log_file: '/var/log/pm2/luxon-nextjs.log',
      time: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'luxon-telegram-bot',
      cwd: '/var/www/luxon/bot_simple',
      script: 'python3',
      args: 'bot.py',
      interpreter: 'none',
      error_file: '/var/log/pm2/luxon-bot-error.log',
      out_file: '/var/log/pm2/luxon-bot-out.log',
      log_file: '/var/log/pm2/luxon-bot.log',
      time: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
