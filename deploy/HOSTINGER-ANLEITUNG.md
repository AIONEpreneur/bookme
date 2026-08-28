# BookMe auf deinem Hostinger-VPS vorführen

Diese Anleitung bringt BookMe im **Vorführ-Modus** auf deine eigene Domain (z. B. `https://bookme.aionepreneur.com`) — mit automatischem HTTPS-Zertifikat und ohne dass du vorher Google-, Stripe- oder SMTP-Konten anlegen musst.

**Was der Vorführ-Modus kann:** Die komplette App ist klickbar — Anmeldung, Terminarten, Verfügbarkeiten, öffentliche Buchungslinks, Buchungsbestätigungen. E-Mails landen in einem eingebauten Posteingang (Dashboard → Integrationen), Zahlungen werden simuliert, der Kalender läuft lokal.

**Was er bewusst nicht ist:** Kein echter E-Mail-Versand, keine Google-Kalender-Synchronisation, keine echten Zahlungen und nicht die gehärtete PostgreSQL-Produktionsarchitektur (siehe [DEPLOYMENT.md](../docs/DEPLOYMENT.md), wenn du später „richtig" live gehen willst).

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

1. Öffne in hPanel deinen VPS und starte den **Browser-Terminal** (Anmeldung als `root`).
2. Füge diesen einen Befehl ein und drücke Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/AIONEpreneur/bookme/main/deploy/hostinger-setup.sh | bash
```

Für eine andere Domain hänge sie an: `… | bash -s -- deine-subdomain.deine-domain.de`

Das Skript installiert Node.js und den HTTPS-Proxy Caddy, holt BookMe aus deinem GitHub-Repository, richtet Datenbank und Systemdienst ein und startet alles.

## Schritt 3: Anmelden

- Am Ende zeigt das Skript deine **Login-Daten** an (auch gespeichert in `/root/bookme-zugangsdaten.txt` — notiere sie sicher und lösche die Datei danach: `rm /root/bookme-zugangsdaten.txt`).
- Öffne `https://bookme.aionepreneur.com` und melde dich an.
- Dein öffentlicher Buchungslink zum Vorführen: `https://bookme.aionepreneur.com/book/strategy-call`

## Gut zu wissen

- **Updates einspielen:** Einfach den Befehl aus Schritt 2 erneut ausführen — Daten bleiben erhalten.
- **Status prüfen:** `systemctl status bookme` · Logs: `journalctl -u bookme -n 50`
- **Neustart:** `systemctl restart bookme`
- **Offene Registrierung:** Im Vorführ-Modus kann jede:r auf der Seite einen Workspace anlegen. Für eine reine Demo ist das okay — wenn du das nicht willst, stoppe die App nach der Vorführung (`systemctl stop bookme`) oder frag nach einer Absicherung.
- **Alles entfernen:** `systemctl disable --now bookme && rm -rf /opt/bookme /etc/systemd/system/bookme.service` und den DNS-Eintrag löschen.
