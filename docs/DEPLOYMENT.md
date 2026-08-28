# Deployment-Anleitung

## Die richtige Deployment-Form wählen

SnagTime ist eine zustandsbehaftete Next.js-Anwendung mit API-Routen, einer relationalen Datenbank, OAuth-Callbacks, Webhooks und asynchroner Kalender- und E-Mail-Verarbeitung.

Sie kann nicht als statische Dateien deployt werden. ChatGPT Sites ist mit dieser Anwendung nicht kompatibel. Vercel wird nicht ohne Weiteres unterstützt, weil das geprüfte Produktiv-Design einen kontinuierlich laufenden Worker und PostgreSQL-Verbindungen mit getrennten Rollen voraussetzt.

Nutze Infrastruktur, die Folgendes unterstützt:

- Einen dauerhaft laufenden Node.js-Web-Container
- Einen separaten, dauerhaft laufenden Worker-Container
- PostgreSQL 18 mit persistentem Speicher und verifiziertem TLS
- HTTPS-Ingress mit einer stabilen Domain
- Secret-Injection zur Laufzeit
- Geplante verschlüsselte Backups

Ein Linux-VPS mit Docker passt am direktesten. Container-Plattformen können ebenfalls funktionieren, wenn sie alle Fähigkeiten oben mitbringen — die mitgelieferte Produktiv-Compose-Datei ist aber ein Referenz-Deployment-Vertrag, keine Ein-Klick-Vorlage für einen bestimmten Anbieter.

## Lokal versus Produktion

| Bereich | Lokale Demo | Produktiv-Vertrag |
|---|---|---|
| Datenbank | SQLite | PostgreSQL 18 |
| Rate Limiting | Prozess-lokal | PostgreSQL-gestützt |
| Hintergrundarbeit | Eingebettet im Web-Prozess | Dedizierter Worker |
| URL | `http://localhost:3000` | Kanonischer HTTPS-Origin |
| Secrets | Von Git ignorierte `.env.local` | Secret-Manager oder gemountete Secret-Dateien |
| Kalender | Lokal oder Google | Google |
| E-Mail | Lokaler Posteingang oder SMTP | TLS-SMTP |
| Zahlungen | Stub oder Stripe-Test | Nur Stripe-Test |

Setze die lokale Demo-Konfiguration niemals dem öffentlichen Internet aus.

## Produktiv-Komponenten

Das Repository liefert:

- `Dockerfile`-Target `runtime` für Web und Worker
- `Dockerfile`-Target `migration` für Datenbank-Migrationen
- `compose.production.yml` als verbindliche Service- und Secret-Topologie
- `infrastructure/postgresql/` für PostgreSQL-TLS und hostbasierte Zugriffskontrollen
- `prisma/postgresql/` für das generierte Schema, die Baseline-Migration, Row-Level Security und Laufzeit-Guards
- `scripts/provision-postgres-logins.mjs` für getrennte Migrations-, App-, Worker- und Monitor-Zugangsdaten
- `scripts/backup-postgres.ps1` und `scripts/restore-postgres.ps1` für verschlüsselte Backup- und Restore-Abläufe

Historische interne Bezeichner, die mit `tempocove` beginnen, bleiben aus Migrationskompatibilität in Datenbankrollen und generierten Artefakten erhalten. Sie sind kein kundensichtbares Branding.

## Deployment-Reihenfolge

### 1. Domain und HTTPS-Ingress vorbereiten

Lege den endgültigen Origin fest, bevor du die Anbieter konfigurierst, zum Beispiel:

```text
https://book.your-domain.example
```

Dein Reverse Proxy muss HTTPS terminieren, jeden vom Client eingehenden Proxy-Authentication-Header entfernen, das vertrauenswürdige `PROXY_SHARED_SECRET` injizieren und die Anfragen an den Web-Container weiterleiten.

### 2. PostgreSQL 18 vorbereiten

Verwende PostgreSQL 18 mit verifiziertem TLS. Die Produktiv-URLs müssen enthalten:

```text
sslmode=verify-full
sslrootcert=/absolute/or/container/path/to/ca.crt
connect_timeout=3
pool_timeout=20
connection_limit=20
statement_timeout=2000
```

Die App-, Worker-, Migrations- und Monitor-URLs verwenden jeweils unterschiedliche Datenbank-Logins. Die Bootstrap-Owner-Zugangsdaten dürfen niemals in den Web- oder Worker-Container gemountet werden.

Generiere und validiere die PostgreSQL-Artefakte:

```bash
npm ci
npm run db:generate:postgres
npm run db:baseline:postgres
```

Provisioniere die Laufzeit-Logins aus einer vom Operator kontrollierten Umgebung:

```bash
npm run db:provision:postgres-logins
```

Dieser Befehl benötigt die Bootstrap-Datenbank-URL plus unabhängige Werte für:

- `TEMPOCOVE_MIGRATION_DB_PASSWORD`
- `TEMPOCOVE_APP_DB_PASSWORD`
- `TEMPOCOVE_WORKER_DB_PASSWORD`
- `TEMPOCOVE_MONITOR_DB_PASSWORD`
- `TENANT_CONTEXT_SECRET`

### 3. Unabhängige Anwendungs-Secrets erstellen

Zu den erforderlichen Anwendungs-Secrets gehören:

- `AUTH_SECRET`
- `BOOKING_CAPABILITY_SECRET`
- `BOOKING_CAPABILITY_KEYRING`
- `TOKEN_ENCRYPTION_KEY`, exakt 64 Hexadezimalzeichen
- `EMAIL_TOKEN_SECRET`
- `TENANT_CONTEXT_SECRET`
- `RATE_LIMIT_HASH_SECRET`
- `PROXY_SHARED_SECRET`
- `OPERATOR_HEALTH_SECRET`
- Anbieter-Secrets für Google, den Stripe-Testmodus und SMTP

Jedes Secret muss unabhängig sein. Speichere sie im Secret-Manager der Plattform oder mounte sie als Dateien. Backe sie niemals in ein Image ein.

### 4. Unveränderliche Images bauen

Verwende den 40-stelligen Git-Commit-SHA als `BUILD_ID`:

```bash
BUILD_ID=$(git rev-parse HEAD)
docker build --build-arg BUILD_ID="$BUILD_ID" --target runtime -t snagtime:"$BUILD_ID" .
docker build --target migration -t snagtime-migration:"$BUILD_ID" .
```

Die Laufzeitumgebung verweigert den Start, wenn die konfigurierte `BUILD_ID` nicht zum kompilierten Build passt.

### 5. Migration, Web und Worker ausführen

Führe zuerst das Migrations-Image mit der Migrations-Datenbank-URL aus. Starte dann zwei Kopien des Runtime-Images:

- Web-Befehl: `node apps/web/server.js`
- Worker-Befehl: `node dist/worker.mjs`

In `compose.production.yml` siehst du die erforderliche Aufteilung der Umgebungsvariablen und Secret-Mounts pro Service. Die Datei deklariert Secrets bewusst als extern — deine Orchestrierungsschicht muss sie vor dem Start anlegen.

### 6. Anbieter konfigurieren

Folge der [Integrations-Einrichtung](INTEGRATION-SETUP.md). Die gehosteten Callbacks verwenden den endgültigen HTTPS-Origin.

### 7. Verifizieren, bevor du einen Buchungslink teilst

Mindestens:

1. Bestätige, dass `/api/health/live` antwortet.
2. Bestätige, dass `/api/health/ready` „ready" meldet.
3. Registriere und verifiziere ein frisches Konto.
4. Verbinde Google Calendar und prüfe das Frei/Belegt-Blocken.
5. Erstelle, buche um und storniere eine kostenlose Buchung.
6. Bestätige die SMTP-Zustellung an Gastgeber:in und Gast von unbeteiligten Postfächern aus.
7. Schließe eine Stripe-Testbuchung ab und erstatte sie zurück.
8. Starte Web- und Worker-Container neu und prüfe, dass die Daten intakt bleiben.
9. Führe ein verschlüsseltes Backup aus und spiele es in eine isolierte leere Datenbank zurück.

## Hinweise zu Plattformen

### Vercel

Vom aktuellen Produktiv-Vertrag dieses Repositories nicht unterstützt. Das Web-Frontend ist Next.js, aber das System braucht zusätzlich PostgreSQL-Laufzeitrollen und einen dedizierten, kontinuierlich laufenden Worker.

### ChatGPT Sites

Nicht kompatibel. Dies ist keine statische Website — die Anwendung braucht serverseitigen Code, persistenten Speicher, OAuth-Callbacks und Webhooks.

### Railway, Render, Fly.io und ähnliche Plattformen

Potenziell kompatibel, wenn sie als getrennte Web- und Worker-Services mit PostgreSQL, stabilem HTTPS, gemounteten Secrets und der erforderlichen Datenbank-TLS-Konfiguration eingerichtet werden. Diese Version enthält keine Ein-Klick-Vorlage und hat keine verifiziert.

### Linux-VPS mit Docker

Die engste Entsprechung zur mitgelieferten Architektur, weil du Reverse Proxy, Zertifikate, PostgreSQL-Container, Secret-Mounts, Worker und Backups selbst kontrollierst. Sie bringt aber auch die meiste Betriebsverantwortung mit sich.

## Betriebsverantwortung

Die MIT-lizenzierte Software ist kostenlos. Ein öffentlicher Dienst ist aber nicht wartungsfrei. Wer deployt, trägt die Verantwortung für:

- Hosting- und Domain-Kosten
- Datenbank-Kapazität und Backups
- Sicherheitsupdates und Dependency-Warnungen
- Google-OAuth-Zustimmung und Verifizierungsanforderungen
- SMTP-Reputation, SPF, DKIM, DMARC und Zustellbarkeit
- Stripe-Konto-Konfiguration und jede zukünftige Live-Modus-Implementierung
- Datenschutzerklärung, AGB, Datenaufbewahrung und regulatorische Pflichten
- Monitoring, Incident Response und Disaster Recovery
