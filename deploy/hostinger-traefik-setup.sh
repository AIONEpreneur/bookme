#!/usr/bin/env bash
# BookMe Vorführ-Deployment hinter einem BESTEHENDEN Traefik (Docker-Provider).
# Für Server, auf denen bereits Traefik die Ports 80/443 bedient und Apps in
# Docker laufen. BookMe wird ein eigenständiger Container im Compose-Projekt
# "bookme": kein Host-Port, keine Änderung an Traefik oder anderen Containern —
# die Anmeldung beim Proxy passiert ausschließlich über Labels am eigenen
# Container. Bricht bei fehlenden Voraussetzungen ab, bevor etwas verändert wird.
#
# Aufruf: bash hostinger-traefik-setup.sh [domain] [traefik-netzwerk] [certresolver]
# Standard: bookme.aionepreneur.com app_extern mytlschallenge
# Erneuter Aufruf aktualisiert Code und Container, ohne Daten zu löschen.
set -euo pipefail

DOMAIN="${1:-bookme.aionepreneur.com}"
TRAEFIK_NETWORK="${2:-app_extern}"
CERT_RESOLVER="${3:-mytlschallenge}"
REPO_URL="https://github.com/AIONEpreneur/bookme"
APP_DIR="/opt/bookme"
CREDS_FILE="/root/bookme-zugangsdaten.txt"

fail() { echo; echo "❌ ABBRUCH (es wurde nichts verändert): $1"; echo "   $2"; exit 1; }

echo "==> BookMe-Setup (Traefik-Variante) für https://${DOMAIN}"

echo "==> 1/6 Vorab-Prüfung"
command -v docker >/dev/null 2>&1 || fail "Docker wurde nicht gefunden." "Diese Variante ist für Server mit laufendem Docker und Traefik gedacht."
docker compose version >/dev/null 2>&1 || fail "Docker Compose (v2) wurde nicht gefunden." "Bitte melde dich mit dieser Meldung zurück."
docker ps --format '{{.Names}}' | grep -qi traefik || fail "Es läuft kein Traefik-Container." "Diese Variante erwartet einen laufenden Traefik als Reverse Proxy."
docker network inspect "${TRAEFIK_NETWORK}" >/dev/null 2>&1 || fail "Das Docker-Netzwerk '${TRAEFIK_NETWORK}' existiert nicht." "Verfügbare Netzwerke zeigt: docker network ls — gib das richtige als 2. Argument an."
command -v git >/dev/null 2>&1 || { export DEBIAN_FRONTEND=noninteractive; apt-get update -y && apt-get install -y git; }
echo "   Prüfung bestanden: Traefik läuft, Netzwerk '${TRAEFIK_NETWORK}' vorhanden."

echo "==> 2/6 BookMe-Code holen"
if [ ! -d "${APP_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
else
  git -C "${APP_DIR}" pull --ff-only
fi
cd "${APP_DIR}"

echo "==> 3/6 Container-Dateien schreiben (nur in ${APP_DIR})"
cat > "${APP_DIR}/container-start.sh" <<'START'
#!/usr/bin/env bash
set -euo pipefail
cd /app
if [ ! -f node_modules/.install-stamp ] || [ package-lock.json -nt node_modules/.install-stamp ]; then
  npm ci
  touch node_modules/.install-stamp
fi
npx dotenv -e .env.local -- npm run db:generate
npx dotenv -e .env.local -- npm run db:migrate
npx dotenv -e .env.local -- npm run db:seed
exec npx dotenv -e .env.local -- npm run dev --workspace @snagtime/web -- --port 3000 --hostname 0.0.0.0
START
chmod +x "${APP_DIR}/container-start.sh"

cat > "${APP_DIR}/compose.demo.yml" <<COMPOSE
name: bookme
services:
  web:
    image: node:24-bookworm
    restart: unless-stopped
    working_dir: /app
    command: ["bash", "/app/container-start.sh"]
    environment:
      NEXT_TELEMETRY_DISABLED: "1"
    volumes:
      - ${APP_DIR}:/app
    networks: [traefik_net]
    labels:
      traefik.enable: "true"
      traefik.docker.network: "${TRAEFIK_NETWORK}"
      traefik.http.routers.bookme.rule: "Host(\`${DOMAIN}\`)"
      traefik.http.routers.bookme.entrypoints: "websecure"
      traefik.http.routers.bookme.tls.certresolver: "${CERT_RESOLVER}"
      traefik.http.services.bookme.loadbalancer.server.port: "3000"
networks:
  traefik_net:
    name: ${TRAEFIK_NETWORK}
    external: true
COMPOSE

echo "==> 4/6 Konfiguration erzeugen"
if [ ! -f .env.local ]; then
  docker compose -f compose.demo.yml run --rm --no-deps web npm run setup | tee "${CREDS_FILE}"
  chmod 600 "${CREDS_FILE}"
  echo "==> Zugangsdaten wurden in ${CREDS_FILE} gespeichert. Bitte sicher notieren und die Datei danach löschen."
fi
[ -f .env.local ] || fail "Die Konfigurationsdatei .env.local wurde nicht erzeugt." "Bitte melde dich mit der Ausgabe des Setup-Schritts zurück."
sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=\"https://${DOMAIN}\"|" .env.local
grep -q '^DEV_ALLOWED_ORIGIN=' .env.local || echo "DEV_ALLOWED_ORIGIN=\"${DOMAIN}\"" >> .env.local
sed -i "s|^DEV_ALLOWED_ORIGIN=.*|DEV_ALLOWED_ORIGIN=\"${DOMAIN}\"|" .env.local

echo "==> 5/6 BookMe-Container starten"
docker compose -f compose.demo.yml up -d

echo "==> 6/6 Warte auf den App-Start (erster Start installiert und kompiliert — bis zu 10 Minuten) …"
ok=""
for _ in $(seq 1 120); do
  if docker compose -f compose.demo.yml exec -T web node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    ok="ja"; break
  fi
  sleep 5
done

echo
if [ -n "${ok}" ]; then
  echo "✅ BookMe läuft. Öffne jetzt: https://${DOMAIN}"
  echo "   (Voraussetzung: Der DNS-A-Record für ${DOMAIN} zeigt auf die IP dieses Servers."
  echo "    Das HTTPS-Zertifikat holt Traefik automatisch, sobald der DNS-Eintrag greift.)"
  [ -f "${CREDS_FILE}" ] && echo "   Login-Daten: siehe ${CREDS_FILE}"
else
  echo "⚠️  Die App antwortet noch nicht. Logs ansehen mit:"
  echo "    docker compose -f ${APP_DIR}/compose.demo.yml logs --tail 80"
fi
