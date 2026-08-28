#!/usr/bin/env bash
# BookMe Vorführ-Deployment für einen Hostinger-VPS (Ubuntu/Debian, als root ausführen).
# Richtet den credential-freien Demo-Modus hinter Caddy (automatisches HTTPS) ein.
#
# Sicherheitsprinzip: Dieses Skript ist so gebaut, dass es bestehende Apps auf dem
# Server NICHT anfasst. Es bricht mit einer klaren Meldung ab, BEVOR es etwas
# verändert, wenn es einen möglichen Konflikt erkennt (anderer Webserver auf
# Port 80/443, zu alte Node-Version). Es überschreibt niemals eine bestehende
# Caddy-Konfiguration, sondern ergänzt nur einen eigenen Eintrag, und es
# installiert bzw. aktualisiert Node nur, wenn gar kein Node vorhanden ist.
#
# Aufruf:  bash hostinger-setup.sh [domain]     (Standard: bookme.aionepreneur.com)
# Erneuter Aufruf aktualisiert Code und Konfiguration, ohne Daten zu löschen.
set -euo pipefail

DOMAIN="${1:-bookme.aionepreneur.com}"
REPO_URL="https://github.com/AIONEpreneur/bookme"
APP_DIR="/opt/bookme"
CREDS_FILE="/root/bookme-zugangsdaten.txt"

fail() { echo; echo "❌ ABBRUCH (es wurde nichts verändert): $1"; echo "   $2"; exit 1; }

echo "==> BookMe-Setup für https://${DOMAIN}"
echo "==> 0/7 Vorab-Prüfung: bestehende Apps dürfen nicht gestört werden"

# 0a. Läuft bereits ein anderer Webserver auf Port 80/443?
# Funktioniert auch ohne Zusatztools: erst ss (falls vorhanden), sonst TCP-Probe.
listening() {
  if command -v ss >/dev/null 2>&1; then ss -tln 2>/dev/null | awk '{print $4}' | grep -q ":$1\$"
  else (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1; fi
}
port_owner() { command -v ss >/dev/null 2>&1 && ss -tlnp 2>/dev/null | awk -v p=":$1" '$4 ~ p"$" {print $NF}' | grep -oP '(?<=\(\(")[^"]+' | head -1 || true; }
for p in 80 443; do
  if listening "$p" && ! systemctl is-active --quiet caddy 2>/dev/null; then
    owner="$(port_owner "$p")"
    fail "Auf Port ${p} läuft bereits ein anderer Webserver${owner:+ ('"$owner"')} — vermutlich für deine bestehenden Apps." \
         "BookMe muss dann in diesen Webserver integriert werden statt Caddy zu installieren. Bitte melde dich mit dieser Meldung zurück."
  fi
done

# 0b. Node-Version prüfen: nur installieren, wenn gar keins da ist. Nie ungefragt upgraden.
NEED_NODE="nein"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if [ "$NODE_MAJOR" -lt 20 ]; then
    fail "Auf dem Server ist Node $(node -v) installiert — vermutlich für deine bestehenden Apps." \
         "BookMe braucht Node 20+. Ein Upgrade könnte die anderen Apps stören, deshalb stoppe ich hier. Bitte melde dich mit dieser Meldung zurück."
  fi
else
  NEED_NODE="ja"
fi

# 0c. Freien lokalen Port für BookMe wählen (nichts Bestehendes verdrängen).
APP_PORT=""
for p in 3005 3006 3007 3008 3009 3010 3011 3012; do
  if ! listening "$p"; then APP_PORT="$p"; break; fi
done
[ -n "$APP_PORT" ] || fail "Kein freier lokaler Port (3005–3012) gefunden." "Bitte melde dich mit der Ausgabe von: ss -tlnp"
echo "   Vorab-Prüfung bestanden. BookMe nutzt den lokalen Port ${APP_PORT}."

echo "==> 1/7 Grundpakete installieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git gnupg

echo "==> 2/7 Node.js"
if [ "$NEED_NODE" = "ja" ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
echo "   Node: $(node --version)"

echo "==> 3/7 Caddy (HTTPS-Proxy)"
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

echo "==> 6/7 BookMe als eigenen Systemdienst einrichten (bookme.service)"
cat > /etc/systemd/system/bookme.service <<UNIT
[Unit]
Description=BookMe Terminbuchung (Demo-Modus)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/npx dotenv -e .env.local -- npm run dev --workspace @snagtime/web -- --port ${APP_PORT} --hostname 127.0.0.1
Restart=always
RestartSec=5
Environment=NEXT_TELEMETRY_DISABLED=1

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable bookme >/dev/null
systemctl restart bookme

echo "==> 7/7 HTTPS-Eintrag für ${DOMAIN} ergänzen (bestehende Caddy-Einträge bleiben unangetastet)"
mkdir -p /etc/caddy
touch /etc/caddy/Caddyfile
if grep -q "^${DOMAIN}\b" /etc/caddy/Caddyfile; then
  echo "   Eintrag für ${DOMAIN} existiert bereits — unverändert gelassen."
else
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.sicherung-$(date +%Y%m%d-%H%M%S)"
  cat >> /etc/caddy/Caddyfile <<CADDY

${DOMAIN} {
    reverse_proxy 127.0.0.1:${APP_PORT}
}
CADDY
fi
caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy >/dev/null
systemctl reload caddy 2>/dev/null || systemctl restart caddy

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
fi

echo "==> Warte auf den App-Start (der erste Start kompiliert und kann 1–2 Minuten dauern) …"
ok=""
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${APP_PORT}/api/health/live"; then ok="ja"; break; fi
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
