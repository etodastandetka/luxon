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
      name: 'luxon-admin-nextjs',
      cwd: '/var/www/luxon/admin_nextjs',
      script: 'npm',
      args: 'run start',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/pm2/luxon-admin-nextjs-error.log',
      out_file: '/var/log/pm2/luxon-admin-nextjs-out.log',
      log_file: '/var/log/pm2/luxon-admin-nextjs.log',
      time: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
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
      name: 'luxon-bot',
      cwd: '/var/www/luxon/bot_simple',
      script: '/var/www/luxon/django_admin/venv/bin/python3',
      args: 'bot.py',
      interpreter: 'none',
      error_file: '/var/log/pm2/luxon-bot-error.log',
      out_file: '/var/log/pm2/luxon-bot-out.log',
      log_file: '/var/log/pm2/luxon-bot.log',
      time: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'luxon-email-watcher',
      cwd: '/var/www/luxon/admin_nextjs',
      script: 'npm',
      args: 'run watcher',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/luxon-watcher-error.log',
      out_file: '/var/log/pm2/luxon-watcher-out.log',
      log_file: '/var/log/pm2/luxon-watcher.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'luxon-support-bot',
      cwd: '/var/www/luxon/bot_simple',
      script: '/var/www/luxon/django_admin/venv/bin/python3',
      args: 'support_bot.py',
      interpreter: 'none',
      env: {
        SUPPORT_BOT_TOKEN: '8390085986:AAH9iS53RgIleXC-JfExWv8SxwvJR1rPdbI'
      },
      error_file: '/var/log/pm2/luxon-support-bot-error.log',
      out_file: '/var/log/pm2/luxon-support-bot-out.log',
      log_file: '/var/log/pm2/luxon-support-bot.log',
      time: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
