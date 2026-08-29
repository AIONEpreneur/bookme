<div align="center">
  <img src="apps/web/public/bookme-logo.svg" alt="BookMe" width="305" />

  <p><strong>Schnapp dir einen Termin. Werde gebucht.</strong></p>
  <p>Eine kostenlose, selbst hostbare Terminbuchungs-App für Verfügbarkeiten, Buchungslinks, Kalender-Synchronisation, E-Mail-Benachrichtigungen und Testzahlungen.</p>
</div>

## Was BookMe kann

BookMe gibt dir den Quellcode für dein eigenes Terminbuchungssystem. Du kannst es kostenlos lokal laufen lassen, anpassen und auf Infrastruktur hosten, die du selbst kontrollierst.

- Registrierung, Anmeldung, Passwort-Wiederherstellung und E-Mail-Bestätigung
- Workspaces, Mitglieder, Einladungen und Workspace-Wechsel
- Terminarten mit mehreren Dauern und optionalen Testpreisen
- Wöchentliche Verfügbarkeit, Ausnahmen für einzelne Tage, Pufferzeiten, Mindestvorlauf und Buchungszeitfenster
- Öffentliche Buchungslinks mit Zeitzonen-Handling und eigenen Fragen
- Buchungsbestätigung, Umbuchung, Stornierung und Wiederherstellungs-Links
- Google Calendar: Frei/Belegt-Abgleich und Termin-Erstellung
- Stripe Checkout im Testmodus, inklusive Webhook-Bestätigung und Rückerstattungen
- SMTP-E-Mails für Gastgeber:innen und Gäste
- Eigenes Workspace-Branding, Akzentfarben, Profilbilder und hochgeladene Logos
- SQLite für die lokale Demo und eine gehärtete PostgreSQL-Architektur für den Produktivbetrieb

## Einrichtung mit Codex oder Claude Code

Du kannst einem KI-Coding-Assistenten die URL dieses Repositories geben und die lokale Installation von ihm erledigen lassen. Der Assistent pausiert bei den Konto-Schritten, die nur du selbst durchführen kannst.

Öffne die [KI-gestützte Einrichtung](docs/AI-SETUP.md), kopiere den vorbereiteten Prompt und füge ihn zusammen mit diesem Repository-Link in Codex oder Claude Code ein:

```text
https://github.com/aionepreneur/bookme
```

Die Anleitung trennt sauber zwischen der lokalen Demo ohne Zugangsdaten, optionalen Integrationen und dem fortgeschrittenen öffentlichen Deployment — so zieht dich der Assistent nicht in Infrastruktur-Arbeit, bevor die App überhaupt lokal läuft.

## Lokale Einrichtung in fünf Minuten

### Voraussetzungen

- Node.js 20.9 oder neuer. Node.js 24 ist die verifizierte Laufzeitumgebung.
- npm
- Git

### 1. Repository klonen und öffnen

```bash
git clone https://github.com/aionepreneur/bookme.git
cd bookme
```

### 2. Lokale Konfiguration erzeugen

```bash
npm run setup
```

Der Setup-Befehl erstellt eine von Git ignorierte `.env.local`, generiert unabhängige kryptografische Secrets und zeigt die lokalen Demo-Zugangsdaten einmalig an. Du kannst stattdessen auch eigene Zugangsdaten für die Gastgeber:in angeben:

```bash
npm run setup -- --email you@example.com --password "YourStrong!Password7"
```

### 3. Installieren, Datenbank vorbereiten und BookMe starten

```bash
npm run demo:free
```

Öffne [http://localhost:3000](http://localhost:3000) und melde dich mit den Zugangsdaten an, die der Setup-Befehl angezeigt hat.

Der lokale Modus ohne Zugangsdaten nutzt SQLite, einen lokalen Kalender-Adapter, einen lokalen E-Mail-Posteingang und einen Zahlungs-Stub. Er ruft weder Google noch Stripe auf.

## Deine Dienste verbinden

Mit dem Repository bekommst du die komplette Software. Externe Integrationen gehören trotzdem dir und müssen mit deinen eigenen Konten eingerichtet werden.

| Funktion | Was du bereitstellst | Für die lokale Demo nötig? |
|---|---|---:|
| Datenbank | Nichts für SQLite, PostgreSQL für den Produktivbetrieb | Nein |
| Öffentliches Hosting | HTTPS-Domain plus dauerhaft laufender Node-Webservice und Worker | Nein |
| Google Calendar | OAuth Client-ID und Client-Secret | Nein |
| Transaktionale E-Mails | SMTP-Host, Benutzer, Passwort und verifizierte Absender-Domain | Nein |
| Stripe-Zahlungen | Stripe-Test-Secret, Publishable Key und Webhook-Secret | Nein |

In der [Integrations-Einrichtung](docs/INTEGRATION-SETUP.md) findest du die exakten Callback-URLs, Umgebungsvariablen und Prüfschritte.

## Ins Internet bringen

BookMe ist eine dynamische Anwendung, keine statische Website. Sie braucht serverseitiges Node.js, eine dauerhafte Datenbank, Webhook-Endpunkte und einen kontinuierlich laufenden Hintergrund-Worker.

- ChatGPT Sites ist als Produktiv-Hosting für dieses Repository nicht geeignet.
- Vercel wird nicht ohne Weiteres unterstützt, weil das aktuelle Produktiv-Design einen dauerhaft laufenden Worker und PostgreSQL-Laufzeitrollen voraussetzt.
- Ein Linux-VPS oder eine Container-Plattform mit Webservice, Worker-Service, persistentem PostgreSQL, Secrets und HTTPS ist die richtige Umgebung.

**Schneller Vorführ-Weg:** Für eine klickbare Demo auf deiner eigenen Domain (ohne Google-, Stripe- und SMTP-Konten) gibt es die [Hostinger-VPS-Anleitung](deploy/HOSTINGER-ANLEITUNG.md) mit fertigem Setup-Skript.

Die vollständige Produktiv-Architektur ist bewusst streng: PostgreSQL 18, erzwungene Row-Level Security, getrennte Zugangsdaten für App und Worker, verifiziertes Datenbank-TLS und authentifizierter Proxy-Zugang. Lies die [Deployment-Anleitung](docs/DEPLOYMENT.md), bevor du dich für einen Hoster entscheidest.

## Was ist wirklich kostenlos?

Der BookMe-Quellcode ist unter der MIT-Lizenz kostenlos. Auch der lokale Betrieb kann komplett kostenlos sein.

Ein öffentliches Deployment kann trotzdem Kosten bei Drittanbietern verursachen:

- Hosting oder ein VPS
- Ein Domainname
- Managed PostgreSQL, falls dein Hoster keins mitbringt
- Versandvolumen für transaktionale E-Mails
- Anbietergebühren für alle Dienste, die du verbindest

Google-OAuth-Zugangsdaten kannst du erstellen, ohne für BookMe zu bezahlen. Der Stripe-Testmodus ist zum Testen kostenlos.

> **Wichtig: Stripe funktioniert ausschließlich im TESTMODUS.** Diese Version lehnt Stripe-Live-Schlüssel absichtlich ab. Bewirb sie nicht als echten Zahlungsanbieter, ohne vorher Live-Modus-Unterstützung zu implementieren und sicherheitstechnisch prüfen zu lassen.

## Nützliche Befehle

```bash
npm run setup          # Create .env.local and local credentials
npm run setup:check    # Validate the credential-free local configuration
npm run demo:free      # Install, migrate, seed, and run the free local demo
npm run dev            # Run the configured local development server
npm run test           # Run the unit and contract test suite
npm run typecheck      # Check TypeScript
npm run lint           # Run ESLint
npm run build          # Create the Next.js production build
npm run ci:secret-scan # Scan public source files for credential patterns
```

Datenbank-Befehle:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

`npm run db:reset` löscht die lokale SQLite-Datenbank unwiderruflich. Nutze den Befehl nur, wenn du bewusst eine frische Demo willst.

## Projektstruktur

```text
apps/web/             Next.js application and API routes
apps/web/public/      BookMe logo and icon
prisma/               SQLite schema, PostgreSQL schema, and migrations
scripts/              Setup, database, worker, security, and verification tools
infrastructure/       PostgreSQL container hardening
tests/                Browser and end-to-end tests
docs/                 Setup, deployment, and brand documentation
```

## Projektstatus

Die lokale SQLite-Variante und die Integrations-Testpfade sind für Demos, Entwicklung und persönliches Ausprobieren gedacht. Die Produktiv-Architektur ist ein fortgeschrittener Self-Hosting-Weg, kein verwalteter Ein-Klick-Dienst. Du bist selbst verantwortlich für Infrastruktur-Sicherheit, Backups, Anbieter-Konfiguration, E-Mail-Zustellbarkeit, Compliance und den laufenden Betrieb.

Bitte lies die [Sicherheitshinweise](SECURITY.md), bevor du ein Deployment öffentlich zugänglich machst.

## Mitmachen

Issues und Pull Requests sind willkommen. Siehe [CONTRIBUTING.md](CONTRIBUTING.md).

## Lizenz

BookMe ist unter der [MIT-Lizenz](LICENSE) verfügbar. Es basiert auf einem MIT-lizenzierten Open-Source-Projekt; der ursprüngliche Lizenztext bleibt, wie von der Lizenz verlangt, in der Datei [LICENSE](LICENSE) erhalten.
