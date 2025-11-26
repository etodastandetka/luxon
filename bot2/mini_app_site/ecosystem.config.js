module.exports = {
  apps: [
    {
      name: 'luxon-client-site',
      cwd: __dirname,
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3030',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
  ],
}

