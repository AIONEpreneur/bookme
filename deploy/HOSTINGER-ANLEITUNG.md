# BookMe auf deinem Hostinger-VPS vorführen

Diese Anleitung bringt BookMe im **Vorführ-Modus** auf deine eigene Domain (z. B. `https://bookme.aionepreneur.com`) — mit automatischem HTTPS-Zertifikat und ohne dass du vorher Google-, Stripe- oder SMTP-Konten anlegen musst.

**Was der Vorführ-Modus kann:** Die komplette App ist klickbar — Anmeldung, Terminarten, Verfügbarkeiten, öffentliche Buchungslinks, Buchungsbestätigungen. E-Mails landen in einem eingebauten Posteingang (Dashboard → Integrationen), Zahlungen werden simuliert, der Kalender läuft lokal.

**Was er bewusst nicht ist:** Kein echter E-Mail-Versand, keine Google-Kalender-Synchronisation, keine echten Zahlungen und nicht die gehärtete PostgreSQL-Produktionsarchitektur (siehe [DEPLOYMENT.md](../docs/DEPLOYMENT.md), wenn du später „richtig" live gehen willst).

## Sicherheit für bestehende Apps auf dem Server

Das Setup-Skript ist so gebaut, dass es andere Anwendungen auf dem VPS nicht stört:

- **Vorab-Prüfung vor jeder Änderung:** Läuft auf Port 80/443 bereits ein anderer Webserver (z. B. nginx für bestehende Apps) oder ist eine ältere Node-Version installiert, bricht das Skript mit einer klaren Meldung ab, **bevor** es irgendetwas verändert.
- **Eigener Bereich:** BookMe lebt komplett in `/opt/bookme`, als eigener Dienst `bookme.service`, auf einem automatisch gewählten freien Port (3005–3012).
- **Nichts wird überschrieben:** Eine bestehende Caddy-Konfiguration wird nur um einen eigenen Eintrag ergänzt (mit vorheriger Sicherungskopie), niemals ersetzt. Node wird nur installiert, wenn gar keins vorhanden ist.

Wer vorher sehen möchte, was auf dem Server läuft, kann diesen rein lesenden Befehl ausführen und die Ausgabe prüfen (er verändert nichts):

```bash
echo "— Ports 80/443/3000-3012 —"; ss -tlnp 2>/dev/null | grep -E ':(80|443|30[0-1][0-9]) ' || echo "nichts gefunden"; echo "— Node —"; node -v 2>/dev/null || echo "kein Node"; echo "— Docker-Container —"; docker ps --format '{{.Names}} -> {{.Ports}}' 2>/dev/null || echo "kein Docker"; echo "— Aktive Webserver —"; for s in nginx apache2 caddy traefik; do systemctl is-active --quiet $s 2>/dev/null && echo "$s läuft"; done; echo "fertig"
```

## Voraussetzungen

- Ein Hostinger-VPS mit Ubuntu oder Debian (empfohlen: mindestens 2 GB RAM, z. B. KVM 2)
- Deine Domain liegt bei Hostinger (für den DNS-Eintrag)

## Schritt 1: DNS-Eintrag anlegen (2 Minuten)

1. Öffne hPanel → **VPS** → notiere dir die **IP-Adresse** deines Servers.
2. Öffne hPanel → **Domains** → `aionepreneur.com` → **DNS / Nameserver**.
3. Lege einen neuen Eintrag an:
   - **Typ:** A
   - **Name:** `bookme`
   - **Verweist auf:** die IP-Adresse deines VPS
   - **TTL:** Standard belassen
4. Speichern. (Die Änderung ist meist in wenigen Minuten aktiv.)

## Schritt 2: Setup-Skript auf dem Server ausführen (5–10 Minuten)

Öffne in hPanel deinen VPS und starte den **Browser-Terminal** (Anmeldung als `root`). Es gibt zwei Varianten — welche du brauchst, hängt davon ab, was auf dem Server schon läuft:

**Variante A — leerer Server (kein Webserver auf Port 80/443):**

```bash
curl -fsSL https://raw.githubusercontent.com/AIONEpreneur/bookme/main/deploy/hostinger-setup.sh | bash
```

Installiert Node.js und den HTTPS-Proxy Caddy, richtet Datenbank und Systemdienst ein und startet alles.

**Variante B — auf dem Server läuft bereits Traefik mit Docker-Apps:**

```bash
curl -fsSL https://raw.githubusercontent.com/AIONEpreneur/bookme/main/deploy/hostinger-traefik-setup.sh | bash
```

Startet BookMe als eigenen Docker-Container, der sich per Labels beim vorhandenen Traefik anmeldet — ohne Host-Port und ohne Änderungen an Traefik oder anderen Containern. Standardwerte: Domain `bookme.aionepreneur.com`, Netzwerk `app_extern`, Zertifikats-Resolver `mytlschallenge`; andere Werte als Argumente anhängen: `… | bash -s -- meine-domain.de mein-netz mein-resolver`

Beide Skripte prüfen die Voraussetzungen zuerst und brechen ab, bevor sie etwas verändern, wenn sie nicht passen. Für eine andere Domain bei Variante A: `… | bash -s -- deine-subdomain.deine-domain.de`

## Schritt 3: Anmelden

- Am Ende zeigt das Skript deine **Login-Daten** an (auch gespeichert in `/root/bookme-zugangsdaten.txt` — notiere sie sicher und lösche die Datei danach: `rm /root/bookme-zugangsdaten.txt`).
- Öffne `https://bookme.aionepreneur.com` und melde dich an.
- Dein öffentlicher Buchungslink zum Vorführen: `https://bookme.aionepreneur.com/book/strategy-call`

## Gut zu wissen

- **Updates einspielen:** Einfach den Befehl aus Schritt 2 erneut ausführen — Daten bleiben erhalten.
- **Status prüfen (Variante A):** `systemctl status bookme` · Logs: `journalctl -u bookme -n 50` · Neustart: `systemctl restart bookme`
- **Status prüfen (Variante B):** `docker compose -f /opt/bookme/compose.demo.yml ps` · Logs: `docker compose -f /opt/bookme/compose.demo.yml logs --tail 80` · Neustart: `docker compose -f /opt/bookme/compose.demo.yml restart`
- **Offene Registrierung:** Im Vorführ-Modus kann jede:r auf der Seite einen Workspace anlegen. Für eine reine Demo ist das okay — wenn du das nicht willst, stoppe die App nach der Vorführung (`systemctl stop bookme`) oder frag nach einer Absicherung.
- **Alles entfernen (Variante A):** `systemctl disable --now bookme && rm -rf /opt/bookme /etc/systemd/system/bookme.service` und den DNS-Eintrag löschen.
- **Alles entfernen (Variante B):** `docker compose -f /opt/bookme/compose.demo.yml down && rm -rf /opt/bookme` und den DNS-Eintrag löschen.
