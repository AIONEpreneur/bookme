# Zu SnagTime beitragen

Danke, dass du hilfst, SnagTime besser zu machen.

Dieses Repository ist die deutsche Community-Edition von [SnagTime](https://github.com/nateherkai/snagtime). Issues und Pull Requests für diese Variante richtest du bitte an [aionepreneur/bookme](https://github.com/aionepreneur/bookme).

## Entwicklungs-Setup

```bash
git clone https://github.com/aionepreneur/bookme.git
cd bookme
npm run setup
npm run demo:free
```

## Bevor du einen Pull Request öffnest

Führe die lokale Verifizierungs-Suite aus:

```bash
npm ci
npm run db:generate
npm run test
npm run typecheck
npm run lint
npm run build
npm run ci:secret-scan
```

Halte Pull Requests fokussiert. Ergänze Tests für Verhaltensänderungen und erkläre neue Umgebungsvariablen, Migrationen, Anbieter-Berechtigungen oder Deployment-Annahmen.

## Sicherheitsmeldungen

Öffne kein öffentliches Issue für eine Schwachstelle oder ein offengelegtes Credential. Folge [SECURITY.md](SECURITY.md).

## Projektgrenzen

- Committe niemals `.env.local`, Anbieter-Keys, OAuth-Tokens, SMTP-Passwörter, Datenbank-Dumps oder Produktiv-URLs mit Zugangsdaten.
- Beschränke die SQLite-Unterstützung auf lokale Entwicklung und Demos.
- Erhalte das Fail-Closed-Verhalten der Produktion für Anbieter-Konfiguration und Tenant-Isolation.
- Der Stripe-Live-Modus liegt außerhalb der aktuell geprüften Version. Aktiviere ihn nicht ohne Tests, Webhook-Review, Rückerstattungs-Review und aktualisierte Dokumentation.
