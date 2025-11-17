module.exports = {
  apps: [
    {
      name: 'luxon-bot',
      cwd: '/var/www/luxon/bot_simple',
      script: 'venv/bin/python',
      args: 'bot.py',
      interpreter: 'none',
      env: {
        PYTHONUNBUFFERED: '1'
      },
      error_file: '/var/log/pm2/luxon-bot-error.log',
      out_file: '/var/log/pm2/luxon-bot-out.log',
      log_file: '/var/log/pm2/luxon-bot.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'operator_bot',
      cwd: '/var/www/luxon/bot_simple',
      script: 'venv/bin/python',
      args: 'support_bot.py',
      interpreter: 'none',
      env: {
        PYTHONUNBUFFERED: '1',
        SUPPORT_BOT_TOKEN: '8390085986:AAH9iS53RgIleXC-JfExWv8SxwvJR1rPdbI'
      },
      error_file: '/var/log/pm2/operator_bot-error.log',
      out_file: '/var/log/pm2/operator_bot-out.log',
      log_file: '/var/log/pm2/operator_bot.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};

