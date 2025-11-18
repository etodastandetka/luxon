module.exports = {
  apps: [
    {
      name: 'mobcash-token-updater',
      cwd: '/var/www/luxon/admin_nextjs',
      script: 'venv/bin/python',
      args: 'scripts/update_mobcash_tokens.py',
      interpreter: 'none',
      cron_restart: '0 */20 * * *', // Каждые 20 часов
      autorestart: false, // Не перезапускать автоматически, только по cron
      watch: false,
      max_memory_restart: '200M',
      error_file: '/var/log/pm2/mobcash-updater-error.log',
      out_file: '/var/log/pm2/mobcash-updater-out.log',
      log_file: '/var/log/pm2/mobcash-updater.log',
      time: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    }
  ]
}

