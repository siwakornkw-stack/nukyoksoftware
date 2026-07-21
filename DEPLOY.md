# Deploy — Ubuntu VPS

One Next.js app + one PostgreSQL + local file storage. No Vercel.

## 1. System packages

```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx
sudo npm i -g pm2

# sharp needs libvips at runtime; the npm prebuilt binary usually covers it.
```

## 2. PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER dhevakij WITH PASSWORD 'changeme';
CREATE DATABASE dhevakij OWNER dhevakij;
SQL
```

## 3. App

```bash
git clone <repo> /opt/dhevakij && cd /opt/dhevakij
cp .env.example .env        # then edit: DATABASE_URL, JWT_ACCESS_SECRET, CRON_SECRET,
                            #            UPLOAD_DIR, LINE_*, GEMINI_API_KEY
npm ci
npx prisma migrate deploy   # create tables (first deploy: npx prisma migrate dev --name init on a dev box, commit migrations)
npm run db:seed             # default tenant + admin/admin1234  (change the password after!)
npm run build
mkdir -p /var/lib/dhevakij/uploads   # match UPLOAD_DIR in .env
```

## 4. Run (PM2)

```bash
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

## 5. nginx reverse proxy

```nginx
server {
  listen 80;
  server_name your.domain;

  client_max_body_size 25m;   # bill images / Excel uploads

  # NOTE: /uploads is auth-gated by the app (bill photos, payment evidence).
  # Let Next serve it so the session check applies — do NOT add a direct
  # `alias` for /uploads unless you also enforce auth (e.g. nginx auth_request),
  # or you will expose private files without a login.

  location / {
    proxy_pass http://127.0.0.1:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then point the LINE webhook to `https://your.domain/api/fuel/webhook`.

## Cron (alternative to the PM2 worker)

If you drop `dhevakij-cron` from PM2, use the system crontab instead:

```cron
0 1 * * *   curl -s -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3002/api/cron/reminders
0 1 1 * *   curl -s -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3002/api/cron/fuel-monthly
```
