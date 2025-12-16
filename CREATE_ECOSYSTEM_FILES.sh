#!/bin/bash
# Создание ecosystem.config.js файлов на сервере

echo "📝 Создание ecosystem.config.js для админки..."

cat > /var/www/luxon/admin_nextjs/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'luxon-admin',
      cwd: '/var/www/luxon/admin_nextjs',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/pm2/luxon-admin-error.log',
      out_file: '/var/log/pm2/luxon-admin-out.log',
      log_file: '/var/log/pm2/luxon-admin.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      instances: 1,
      exec_mode: 'fork'
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
    }
  ]
}
EOF

echo "✅ ecosystem.config.js для админки создан!"
echo ""
echo "📝 Создание ecosystem.config.js для клиентского сайта..."

cat > /var/www/luxon/bot2/mini_app_site/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'luxon-mini-app',
      cwd: '/var/www/luxon/bot2/mini_app_site',
      script: 'node_modules/.bin/next',
      args: 'start -p 3030',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 3030
      },
      error_file: '/var/log/pm2/luxon-mini-app-error.log',
      out_file: '/var/log/pm2/luxon-mini-app-out.log',
      log_file: '/var/log/pm2/luxon-mini-app.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
EOF

echo "✅ ecosystem.config.js для клиентского сайта создан!"
echo ""
echo "✅ Все файлы созданы! Теперь можно запускать через PM2."

