# shift-monitor

A dark-terminal server health dashboard built with Vue 3 + Vite. Polls HTTP health endpoints across multiple EC2 instances, visualises status history as sparkbars, and persists history across page refreshes via localStorage.

---

## 1. Local dev setup

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. Mock mode is on by default (`VITE_MOCK=true`), so no real servers are required — the dashboard immediately shows simulated traffic with intentional flakiness on `ml-inference`, `report-builder`, and `notification-svc`.

---

## 2. Adding real endpoints (`servers.js`)

Open `src/servers.js` and edit the `servers` array. Each server has:

```js
{
  id: 'my-server-1',        // unique slug used as a key
  name: 'my-server-1',      // display name
  privateIp: '10.0.0.1',    // shown in the header (informational only)
  region: 'us-east-1',      // shown as a badge
  services: [
    {
      name: 'my-api',            // display name
      language: 'node',          // 'java' | 'node' | 'python' | 'go'
      url: 'http://10.0.0.1:3000/health',  // full URL polled by fetch()
      port: 3000,                // informational only
    },
  ],
}
```

**Health endpoint conventions:**

| Language | Path | Expected response |
|---|---|---|
| Java (Spring Boot) | `/actuator/health` | `{ "status": "UP" }` |
| Node.js | `/health` | any 2xx |
| Python Flask/FastAPI | `/health` | any 2xx |
| Go | `/healthz` | any 2xx |

Any 2xx response is treated as **UP**. A non-2xx or network error is **DOWN**. A 2xx with latency > 1 500 ms is **WARN**.

---

## 3. Switching to real HTTP checks

1. Set `VITE_MOCK=false` in `.env` (for dev) **or** run a production build (`.env.production` already sets `VITE_MOCK=false`).
2. Make sure the dashboard host can reach your server IPs (same VPC, VPN, or bastion).
3. Restart the dev server (`npm run dev`) — the composable will now call `fetch()` against the real URLs.

CORS note: if you're running the dashboard on a different origin than your services, add `Access-Control-Allow-Origin: *` (or the dashboard's origin) to your health endpoint responses.

---

## 4. localStorage persistence

On every poll cycle, `useChecker.js` serialises the last 40 status results per service into `localStorage` under the key **`pulse-history`**.

On page load, the stored history is rehydrated before the first poll fires — this means sparkbars are populated immediately on refresh rather than starting empty.

**What's stored:** an object mapping `"serverId:serviceName"` → `string[]` where each string is `"up"`, `"warn"`, or `"down"`.

**To clear history:**

```js
// In the browser console:
localStorage.removeItem('pulse-history')
location.reload()
```

History is trimmed to 40 entries per service and never grows unbounded.

---

## 5. Hosting options

### Option A — S3 + CloudFront (~$0.50/month)

```bash
npm run build          # outputs to dist/
aws s3 sync dist/ s3://your-bucket-name --delete
```

1. Create an S3 bucket with static website hosting enabled.
2. Create a CloudFront distribution pointing at the bucket origin.
3. Set the default root object to `index.html` and add a custom error response: 404 → `/index.html` (200) for SPA routing.
4. Invalidate the CloudFront cache after each deploy: `aws cloudfront create-invalidation --distribution-id XXXX --paths "/*"`.

Estimated cost: S3 storage < $0.01, CloudFront free tier covers 1 TB/month for the first 12 months, then ~$0.0085/GB.

---

### Option B — Nginx on a monitor EC2

```bash
npm run build          # outputs to dist/
rsync -avz dist/ user@monitor-host:/var/www/shift-monitor/
```

Nginx config (`/etc/nginx/sites-available/shift-monitor`):

```nginx
server {
    listen 80;
    server_name monitor.example.internal;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name monitor.example.internal;

    ssl_certificate     /etc/letsencrypt/live/monitor.example.internal/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitor.example.internal/privkey.pem;

    root /var/www/shift-monitor;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
}
```

SSL via Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d monitor.example.internal
```

Symlink and reload:

```bash
sudo ln -s /etc/nginx/sites-available/shift-monitor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

### Option C — GitHub Pages (free)

Good for internal tools accessible behind a VPN-gated GitHub org.

```bash
npm run build
# install gh-pages helper once
npm install -D gh-pages
npx gh-pages -d dist
```

Or add to `package.json`:

```json
"scripts": {
  "deploy": "npm run build && gh-pages -d dist"
}
```

Then run `npm run deploy`. GitHub Pages serves the `gh-pages` branch automatically.

If your repo is at `github.com/org/shift-monitor`, the site will be at `https://org.github.io/shift-monitor/`. Set `base: '/shift-monitor/'` in `vite.config.js` if assets 404 due to the subpath.
