module.exports = {
  apps: [
    {
      name: 'daily-shift-closer',
      cwd: '/var/www/luxon/admin_nextjs',
      script: 'tsx',
      args: 'scripts/close-daily-shift.ts',
      interpreter: 'none',
      cron_restart: '59 23 * * *', // Каждый день в 23:59 - автоматически закрывает смену
      autorestart: false, // Не перезапускать автоматически, только по cron
      watch: false,
      max_memory_restart: '200M',
      error_file: '/var/log/pm2/shift-closer-error.log',
      out_file: '/var/log/pm2/shift-closer-out.log',
      log_file: '/var/log/pm2/shift-closer.log',
      time: true,
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL
      }
    }
  ]
}

