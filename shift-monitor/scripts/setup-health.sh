#!/usr/bin/env bash
# setup-health.sh — deploy health endpoints on a new shift-nexus / cims-cloud server
#
# Usage (run via SSH on the target EC2):
#   bash setup-health.sh
#
# Auto-detects shift-nexus vs cims-cloud. Safe to re-run (idempotent).

set -euo pipefail

# ── detect app ────────────────────────────────────────────────────────────────

APP_DIR=""
APP_TYPE=""

if   [[ -d /home/admin/shift-nexus ]]; then APP_DIR=/home/admin/shift-nexus; APP_TYPE=shift-nexus
elif [[ -d /home/admin/cims-cloud  ]]; then APP_DIR=/home/admin/cims-cloud;  APP_TYPE=cims-cloud
else
  echo "ERROR: neither /home/admin/shift-nexus nor /home/admin/cims-cloud found"
  exit 1
fi

echo "App:     $APP_TYPE at $APP_DIR"
echo "Version: $(node -e "console.log(require('$APP_DIR/package.json').version)" 2>/dev/null || echo '?')"

# ── determine DB driver (mongoose preferred — it's already connected) ─────────

DB_DRIVER="none"
[[ -d "$APP_DIR/node_modules/mongoose" ]] && DB_DRIVER="mongoose"
[[ "$DB_DRIVER" == "none" && -d "$APP_DIR/node_modules/mongodb" ]] && DB_DRIVER="mongodb"
echo "DB:      $DB_DRIVER"

MONGO_VAR="MONGO_URI"
grep -q "^MONGO_URL=" "$APP_DIR/.env" 2>/dev/null && MONGO_VAR="MONGO_URL"

# ── write health router ───────────────────────────────────────────────────────

HEALTH_DIR="$APP_DIR/src/components/health"
mkdir -p "$HEALTH_DIR"

if [[ "$DB_DRIVER" == "mongoose" ]]; then
  DB_SNIPPET='router.get("/db", async (req, res) => {
  try {
    const mongoose = require("mongoose")
    const db = mongoose.connection.db
    if (!db) return res.status(503).json({ version, status: "error", info: "not connected" })
    const stats = await db.stats()
    const size_mb = (stats.dataSize / 1024 / 1024).toFixed(1)
    const info    = `${size_mb} MB · ${stats.collections} cols`
    res.json({ version, status: "ok", info })
  } catch (err) {
    res.status(503).json({ version, status: "error", info: err.message })
  }
})'
elif [[ "$DB_DRIVER" == "mongodb" ]]; then
  DB_SNIPPET="router.get(\"/db\", async (req, res) => {
  const uri = process.env.$MONGO_VAR || \"\"
  if (!uri) return res.status(503).json({ version, status: \"error\", info: \"no $MONGO_VAR\" })
  let client
  try {
    const { MongoClient } = require(\"mongodb\")
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 })
    await client.connect()
    const db    = client.db()
    const stats = await db.stats()
    const size_mb = (stats.dataSize / 1024 / 1024).toFixed(1)
    const info    = \`\${size_mb} MB · \${stats.collections} cols\`
    res.json({ version, status: \"ok\", info })
  } catch (err) {
    res.status(503).json({ version, status: \"error\", info: err.message })
  } finally {
    if (client) client.close().catch(() => {})
  }
})"
else
  DB_SNIPPET='router.get("/db", (_req, res) => {
  res.status(503).json({ version, status: "error", info: "no db driver" })
})'
fi

cat > "$HEALTH_DIR/health.router.js" << ENDROUTER
const express  = require("express")
const router   = express.Router()
const { execSync } = require("child_process")
const { version } = require("../../../package.json")

router.get("/", (req, res) => {
  res.json({ version, status: "ok" })
})

router.get("/disk", (req, res) => {
  try {
    const out = execSync("df / --output=pcent,size,used --block-size=1K 2>/dev/null | tail -1").toString().trim()
    const [pct, totalK, usedK] = out.split(/\s+/)
    const pctNum  = parseInt(pct)
    const totalGB = (parseInt(totalK) / 1024 / 1024).toFixed(1)
    const usedGB  = (parseInt(usedK)  / 1024 / 1024).toFixed(1)
    const info = \`\${usedGB}G / \${totalGB}G (\${pct})\`
    let status = "ok", httpCode = 200
    if      (pctNum >= 100) { status = "full";     httpCode = 429 }
    else if (pctNum >= 90)  { status = "critical"; httpCode = 429 }
    else if (pctNum >= 75)  { status = "warning";  httpCode = 429 }
    return res.status(httpCode).json({ version, status, info })
  } catch (err) {
    return res.status(500).json({ version, status: "error", info: err.message })
  }
})

$DB_SNIPPET

router.get("/livekit", async (req, res) => {
  try {
    const { RoomServiceClient } = require("livekit-server-sdk")
    const livekitHost = process.env.LIVEKIT_HOST
    const apiKey      = process.env.LIVEKIT_API_KEY
    const apiSecret   = process.env.LIVEKIT_API_SECRET
    if (!livekitHost || !apiKey || !apiSecret) {
      return res.json({ version, status: "ok", info: "livekit not configured" })
    }
    const svc   = new RoomServiceClient(livekitHost, apiKey, apiSecret)
    const rooms = await svc.listRooms()
    const info  = \`\${rooms.length} room\${rooms.length === 1 ? "" : "s"}\`
    res.json({ version, status: "ok", info })
  } catch (err) {
    res.status(503).json({ version, status: "error", info: err.message })
  }
})

module.exports = router
ENDROUTER

echo "Created health.router.js"

# ── mount in api.router.js ────────────────────────────────────────────────────

API_ROUTER="$APP_DIR/src/api.router.js"
MOUNT_LINE='apiRouter.use("/health", require("./components/health/health.router.js"));'

if grep -q 'components/health/health.router' "$API_ROUTER" 2>/dev/null; then
  echo "health router already mounted — skipping"
elif grep -q '"/versions"' "$API_ROUTER"; then
  sed -i "s|apiRouter.use(\"/versions\"|${MOUNT_LINE}\napiRouter.use(\"/versions\"|" "$API_ROUTER"
  echo "Mounted /health in api.router.js (before /versions)"
else
  sed -i "s|module.exports = apiRouter|${MOUNT_LINE}\nmodule.exports = apiRouter|" "$API_ROUTER"
  echo "Mounted /health in api.router.js (before module.exports)"
fi

# ── patch socket servers ──────────────────────────────────────────────────────

cat > /tmp/patch_sockets.js << 'NODEPATCH'
const fs   = require("fs")
const path = require("path")
const dir  = process.argv[2]

const targets = [
  { file: "telemetry.server.js", name: "cloud-telemetry" },
  { file: "ais.server.js",       name: "cloud-ais" },
  { file: "livekit.server.js",   name: "cloud-livekit" },
  { file: "features.server.js",  name: "cloud-features" },
]

for (const { file, name } of targets) {
  const p = path.join(dir, file)
  if (!fs.existsSync(p)) { console.log(`SKIP  ${name} (no file)`); continue }
  let src = fs.readFileSync(p, "utf8")
  if (src.includes("prependListener")) { console.log(`SKIP  ${name} (already patched)`); continue }
  const marker = "const httpServer = http.createServer();"
  if (!src.includes(marker)) { console.log(`WARN  ${name}: marker not found`); continue }
  const patch = `const { version: _v } = require("../../package.json");
httpServer.prependListener("request", (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ version: _v, name: "${name}", status: "ok" }));
  }
});`
  fs.writeFileSync(p, src.replace(marker, marker + "\n" + patch))
  console.log(`PATCHED ${name}`)
}
NODEPATCH

node /tmp/patch_sockets.js "$APP_DIR/src/processes"

# ── restart via PM2 ───────────────────────────────────────────────────────────

echo ""
echo "Restarting..."
PM2=pm2
if ! command -v pm2 &>/dev/null; then
  PNPM_PM2=$(find /home/admin/.local/share/pnpm -name pm2 -type f 2>/dev/null | head -1)
  [[ -n "${PNPM_PM2:-}" ]] && PM2="$PNPM_PM2"
fi

$PM2 restart all
sleep 6
$PM2 list

# ── verify ────────────────────────────────────────────────────────────────────

echo ""
echo "Verifying..."
for spec in "cloud-api:9000:/api/health" "disk:9000:/api/health/disk" "db:9000:/api/health/db" \
            "cloud-telemetry:9001:/health" "cloud-ais:9002:/health" "cloud-livekit:9005:/health"; do
  IFS=: read -r label port path_ <<< "$spec"
  result=$(curl -s --max-time 5 "http://localhost:$port$path_" 2>/dev/null)
  if [[ -n "$result" ]]; then
    echo "  OK   $label → $result"
  else
    echo "  FAIL $label (http://localhost:$port$path_)"
  fi
done

echo ""
echo "Done. In the dashboard: Add Server → enter private IP → click 'CiMS template' → Save."
