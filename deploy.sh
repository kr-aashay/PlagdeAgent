#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# deploy.sh — Push AI Ethics Pledge to vucse.app
#
# USAGE (from your Mac):
#   chmod +x deploy.sh
#   ./deploy.sh
#
# FIRST-TIME SETUP ON SERVER (run once manually via SSH):
#   sudo mkdir -p /var/www/ai-pledge/logs
#   sudo chown -R $USER:$USER /var/www/ai-pledge
#   sudo apt install -y nginx nodejs npm
#   sudo npm install -g pm2
#   pm2 startup          # follow the printed command to enable on boot
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config — edit these ────────────────────────────────────────────────────
SERVER_USER="root"                          # SSH user on your VPS
SERVER_HOST="vucse.app"                     # or the server IP
SERVER_DIR="/var/www/ai-pledge"             # where files live on server
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"  # this project folder on Mac

# ── Colours ────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"; CYAN="\033[0;36m"; RESET="\033[0m"
step() { echo -e "${CYAN}▶  $1${RESET}"; }
ok()   { echo -e "${GREEN}✅  $1${RESET}"; }

# ── 1. Sync files (exclude dev-only + secrets) ────────────────────────────
step "Syncing files to ${SERVER_HOST}:${SERVER_DIR}"
rsync -az --delete \
  --exclude='.env' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='*.log' \
  --exclude='deploy.sh' \
  "${LOCAL_DIR}/" "${SERVER_USER}@${SERVER_HOST}:${SERVER_DIR}/"
ok "Files synced"

# ── 2. Install production dependencies on server ──────────────────────────
step "Installing npm dependencies"
ssh "${SERVER_USER}@${SERVER_HOST}" \
  "cd ${SERVER_DIR} && npm install --omit=dev --no-audit --no-fund"
ok "Dependencies installed"

# ── 3. Ensure log dir exists ──────────────────────────────────────────────
ssh "${SERVER_USER}@${SERVER_HOST}" \
  "mkdir -p ${SERVER_DIR}/logs"

# ── 4. Reload or start with PM2 ───────────────────────────────────────────
step "Reloading PM2 process"
ssh "${SERVER_USER}@${SERVER_HOST}" "
  cd ${SERVER_DIR}
  if pm2 list | grep -q 'ai-pledge'; then
    pm2 reload ecosystem.config.js --update-env
  else
    pm2 start ecosystem.config.js
    pm2 save
  fi
"
ok "PM2 reloaded"

# ── 5. Install / reload nginx config ──────────────────────────────────────
step "Installing nginx config and clearing caches"
ssh "${SERVER_USER}@${SERVER_HOST}" "
  sudo cp ${SERVER_DIR}/nginx.conf /etc/nginx/sites-available/ai-pledge
  # Only create symlink if it doesn't exist
  if [ ! -L /etc/nginx/sites-enabled/ai-pledge ]; then
    sudo ln -s /etc/nginx/sites-available/ai-pledge /etc/nginx/sites-enabled/ai-pledge
  fi
  sudo nginx -t && sudo systemctl reload nginx
  
  # Clear any potential caches
  sudo find /var/cache/nginx -type f -delete 2>/dev/null || true
"
ok "nginx reloaded and caches cleared"

# ── 6. Health check ───────────────────────────────────────────────────────
step "Health check"
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://${SERVER_HOST}/APO/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  ok "API is live → https://${SERVER_HOST}/APO/health"
  ok "Frontend  → https://${SERVER_HOST}/oath"
  ok "Admin     → https://${SERVER_HOST}/oath/admin"
else
  echo "⚠️  Health check returned HTTP ${HTTP_CODE}."
  echo "   Check server logs: ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 logs ai-pledge --lines 30'"
fi
