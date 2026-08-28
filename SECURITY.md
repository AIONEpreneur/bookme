# Sicherheitsrichtlinie

## Unterstützte Version

Der aktuelle `main`-Branch erhält Sicherheitskorrekturen. Diese Open-Source-Version ist selbst gehostete Software — wer sie deployt, bleibt verantwortlich für Betriebssystem-Updates, Datenbanksicherheit, Backups, HTTPS, Anbieter-Einstellungen, Absender-Domain-Authentifizierung, Logs und Incident Response.

## Eine Sicherheitslücke melden

Bitte nutze GitHubs private Schwachstellenmeldung (Private Vulnerability Reporting) auf diesem Repository, sofern verfügbar. Schreibe keine Zugangsdaten, personenbezogenen Daten, Exploit-Details oder URLs von Live-Deployments in ein öffentliches Issue.

Falls die private Meldung nicht verfügbar ist, öffne ein öffentliches Issue, das ausschließlich um einen privaten Sicherheitskontakt bittet. Nenne die Details der Schwachstelle nicht in diesem Issue.

## Deployment-Regeln

- Committe niemals `.env`, `.env.local`, `.env.*.local`, Datenbankdateien, OAuth-Tokens, API-Keys oder Secret-Mounts.
- Verwende HTTPS für jedes öffentliche Deployment.
- Verwende unabhängige Zufalls-Secrets. Nutze das Authentifizierungs-Secret nicht zusätzlich für Capability-Signaturen, Verschlüsselung, Rate Limiting, Proxy-Authentifizierung oder E-Mail-Tokens.
- Halte Google-OAuth-Tokens im Ruhezustand verschlüsselt, mit einem stabilen `TOKEN_ENCRYPTION_KEY`.
- Verifiziere SPF, DKIM und DMARC, bevor du dich auf SMTP-Zustellung verlässt.
- Lass Stripe im Testmodus, solange Live-Unterstützung nicht separat implementiert und geprüft wurde.
- Sichere PostgreSQL per Backup und übe die Wiederherstellung, bevor du ein Deployment als produktionsreif betrachtest.
- Prüfe Dependency- und Container-Warnungen nach dem Deployment kontinuierlich.

Das Repository enthält `npm run ci:secret-scan`, aber automatisiertes Scannen ersetzt nicht die Durchsicht jeder Datei und jedes Commits vor der Veröffentlichung.
