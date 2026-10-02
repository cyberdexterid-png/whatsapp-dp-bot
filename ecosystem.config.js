// PM2 process file — keeps the bot alive 24/7 on a VPS.
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 startup   (run the command it prints, for auto-start on reboot)
//   pm2 save
module.exports = {
  apps: [
    {
      name: 'venom-dp-bot',
      script: 'server.js',
      watch: false,
      autorestart: true,
      max_restarts: 20,
      env: {
        PORT: '3000',
        // CLOUDINARY_URL: 'cloudinary://<api_key>:<api_secret>@<cloud_name>',
        // UPLOADS_ENCRYPTION_KEY: '<secret-passphrase>',
      },
    },
  ],
};
