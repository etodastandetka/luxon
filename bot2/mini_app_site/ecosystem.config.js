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

