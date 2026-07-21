// PM2 process file for the Ubuntu VPS.
//   pm2 start ecosystem.config.js
// Runs the Next server + a lightweight cron worker (LINE reminders, monthly fuel report).
module.exports = {
  apps: [
    {
      name: "dhevakij-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production", TZ: "UTC" },
    },
    {
      name: "dhevakij-cron",
      script: "worker/cron.mjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production", TZ: "UTC" },
    },
  ],
};
