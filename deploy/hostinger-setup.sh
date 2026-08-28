#!/usr/bin/env bash
# BookMe Vorführ-Deployment für einen Hostinger-VPS (Ubuntu/Debian, als root ausführen).
# Richtet den credential-freien Demo-Modus hinter Caddy (automatisches HTTPS) ein.
# Aufruf:  bash hostinger-setup.sh [domain]     (Standard: bookme.aionepreneur.com)
# Erneuter Aufruf aktualisiert Code und Konfiguration, ohne Daten zu löschen.
set -euo pipefail

DOMAIN="${1:-bookme.aionepreneur.com}"
REPO_URL="https://github.com/AIONEpreneur/bookme"
APP_DIR="/opt/bookme"
CREDS_FILE="/root/bookme-zugangsdaten.txt"

echo "==> BookMe-Setup für https://${DOMAIN}"

echo "==> 1/7 Grundpakete installieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git gnupg psmisc

echo "==> 2/7 Node.js 24 installieren"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
node --version

echo "==> 3/7 Caddy (HTTPS-Proxy) installieren"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> 4/7 BookMe-Code holen"
if [ ! -d "${APP_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
else
  git -C "${APP_DIR}" pull --ff-only
fi
cd "${APP_DIR}"

echo "==> 5/7 Konfiguration und Datenbank"
if [ ! -f .env.local ]; then
  npm run setup | tee "${CREDS_FILE}"
  chmod 600 "${CREDS_FILE}"
  echo "==> Zugangsdaten wurden in ${CREDS_FILE} gespeichert. Bitte sicher notieren und die Datei danach löschen."
fi
sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=\"https://${DOMAIN}\"|" .env.local
grep -q '^DEV_ALLOWED_ORIGIN=' .env.local || echo "DEV_ALLOWED_ORIGIN=\"${DOMAIN}\"" >> .env.local
sed -i "s|^DEV_ALLOWED_ORIGIN=.*|DEV_ALLOWED_ORIGIN=\"${DOMAIN}\"|" .env.local

npm ci
npx dotenv -e .env.local -- npm run db:generate
npx dotenv -e .env.local -- npm run db:migrate
npx dotenv -e .env.local -- npm run db:seed

echo "==> 6/7 BookMe als Systemdienst einrichten"
cat > /etc/systemd/system/bookme.service <<UNIT
[Unit]
Description=BookMe Terminbuchung (Demo-Modus)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/npx dotenv -e .env.local -- npm run dev --workspace @snagtime/web -- --port 3000 --hostname 127.0.0.1
Restart=always
RestartSec=5
Environment=NEXT_TELEMETRY_DISABLED=1

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable bookme >/dev/null
systemctl restart bookme

echo "==> 7/7 HTTPS-Proxy konfigurieren"
cat > /etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
    reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl enable caddy >/dev/null
systemctl restart caddy

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
fi

echo "==> Warte auf den App-Start (der erste Start kompiliert und kann 1–2 Minuten dauern) …"
ok=""
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/api/health/live; then ok="ja"; break; fi
  sleep 3
done

echo
if [ -n "${ok}" ]; then
  echo "✅ BookMe läuft. Öffne jetzt: https://${DOMAIN}"
  echo "   (Voraussetzung: Der DNS-A-Record für ${DOMAIN} zeigt auf die IP dieses Servers.)"
  [ -f "${CREDS_FILE}" ] && echo "   Login-Daten: siehe ${CREDS_FILE}"
else
  echo "⚠️  Die App antwortet noch nicht. Status ansehen mit:  journalctl -u bookme -n 50"
fi
