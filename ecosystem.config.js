// PM2 process file for the Ubuntu VPS.
//   pm2 start ecosystem.config.js
// Runs the Next server + a lightweight cron worker (LINE reminders, monthly fuel report).
module.exports = {
  apps: [
    {
      name: "dhevakij-web",
      script: "node_modules/next/dist/bin/next",
      // 3000/3001 are taken by the other apps on this VPS.
      args: "start -p 3002",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production", TZ: "UTC" },
    },
    {
      name: "dhevakij-cron",
      script: "worker/cron.mjs",
      // Plain node does not read .env the way Next does; without this the
      // worker falls back to APP_BASE_URL=127.0.0.1:3000 and an empty
      // CRON_SECRET, i.e. it would hit the wrong app on this host.
      node_args: "--env-file=.env",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production", TZ: "UTC" },
    },
  ],
};
