# Integrations-Einrichtung

BookMe funktioniert lokal ohne externe Zugangsdaten. Aktiviere Integrationen erst, wenn der lokale Buchungsablauf funktioniert.

## Google Calendar

### 1. Eine Google-OAuth-Anwendung erstellen

In der Google Cloud Console:

1. Erstelle oder wähle ein Projekt.
2. Aktiviere die Google Calendar API.
3. Konfiguriere den OAuth-Zustimmungsbildschirm.
4. Erstelle einen OAuth-Client mit dem Anwendungstyp **Webanwendung**.
5. Trage deine exakte Callback-URL als autorisierte Weiterleitungs-URI ein.

Lokaler Callback:

```text
http://localhost:3000/api/integrations/google/callback
```

Callback für ein gehostetes Deployment:

```text
https://your-domain.example/api/integrations/google/callback
```

Schema, Host, Port und Pfad müssen exakt übereinstimmen. Wenn die OAuth-App im Testmodus ist, füge das Konto der Gastgeber:in als Testnutzer hinzu.

### 2. BookMe konfigurieren

Setze diese Werte in `.env.local` für die lokale Entwicklung oder im Secret-Manager deines Hosters für das Deployment:

```dotenv
CALENDAR_PROVIDER="google"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALENDAR_ID="primary"
```

Starte BookMe neu, melde dich an, öffne `/integrations` und wähle in der Karte **Google Kalender** die Option **Verbinden**.

BookMe fordert folgende Berechtigungen an:

- `openid`
- `email`
- `https://www.googleapis.com/auth/calendar.freebusy`
- `https://www.googleapis.com/auth/calendar.events`

Prüfe, dass der Integrationsstatus als vollständig gemeldet wird, erstelle eine Testbuchung, bestätige, dass der Termin im Kalender der Gastgeber:in erscheint, und buche ihn dann um und storniere ihn.

## Transaktionale E-Mails

Google-Calendar-Einladungen verschickt Google über den verbundenen Kalender. Die Benachrichtigungen an Gastgeber:innen, Bestätigungen an Gäste, Workspace-Einladungen, Verifizierungs- und Wiederherstellungs-Nachrichten von BookMe laufen über deinen SMTP-Anbieter.

Konfiguriere:

```dotenv
EMAIL_PROVIDER="smtp"
EMAIL_TOKEN_SECRET="replace-with-32-byte-random-secret"
SMTP_HOST="smtp.your-provider.example"
SMTP_PORT="587"
SMTP_TLS_MODE="starttls"
SMTP_USER="your-smtp-user"
SMTP_PASSWORD="your-smtp-password"
EMAIL_FROM="BookMe <notifications@your-domain.example>"
EMAIL_REPLY_TO="support@your-domain.example"
EMAIL_SENDER_DOMAIN="your-domain.example"
```

Verwende `SMTP_TLS_MODE="implicit"` für Anbieter, die implizites TLS verlangen, üblicherweise auf Port 465. Die Adresse in `EMAIL_FROM` muss exakt die `EMAIL_SENDER_DOMAIN` verwenden.

Vor der öffentlichen Nutzung:

1. Verifiziere den Absender bei deinem SMTP-Anbieter.
2. Veröffentliche SPF- und DKIM-Einträge.
3. Veröffentliche eine DMARC-Richtlinie.
4. Buche testweise von einem unbeteiligten Postfach aus.
5. Bestätige, dass die Nachrichten an Gastgeber:in und Gast ankommen und nicht im Spam landen.

## Stripe-Testzahlungen

Diese Version akzeptiert ausschließlich Stripe-Testmodus-Zugangsdaten. Live-Schlüssel und Live-Webhook-Events werden abgelehnt.

Konfiguriere:

```dotenv
PAYMENTS_PROVIDER="stripe"
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Lokale Webhook-Weiterleitung:

```bash
stripe login
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

Kopiere das Signing-Secret, das Stripe CLI ausgibt, in `STRIPE_WEBHOOK_SECRET`, starte BookMe neu und lege eine Termin-Dauer mit einem Testpreis größer als null an.

Für ein gehostetes Deployment erstellst du einen Stripe-Webhook-Endpunkt unter:

```text
https://your-domain.example/api/webhooks/stripe
```

Abonniere diese Events:

- `checkout.session.completed`
- `checkout.session.expired`
- `refund.created`
- `refund.updated`
- `refund.failed`

Prüfe, dass eine Stripe-Testkarte eine bezahlte Buchung bestätigt und dass das Stornieren einer bestätigten Testzahlung den erwarteten Rückerstattungsstatus erzeugt.

### Optional: Stripe CLI Claimable Sandbox

Das Repository kann ein Stripe-CLI-Claimable-Sandbox-Profil in die von Git ignorierte `.env.stripe-sandbox.local` importieren, ohne die Credential-Werte auszugeben:

```powershell
npm run stripe:sandbox:import -- -Profile snagtime-qa
npm run dev:stripe-sandbox
```

Falls sich ein abgelaufenes Profil nicht neu befüllen lässt, erstelle den Ersatz in einer frischen temporären Stripe-Konfiguration und übergib genau diese Konfiguration an jeden Befehl:

```powershell
$freshStripeConfig = Join-Path ([IO.Path]::GetTempPath()) 'snagtime-stripe-rotated.toml'
stripe sandbox create --project-name snagtime-qa-rotated --config $freshStripeConfig
npm run stripe:sandbox:import -- -Profile snagtime-qa-rotated -ConfigPath $freshStripeConfig
stripe listen --project-name snagtime-qa-rotated --config $freshStripeConfig --forward-to http://localhost:3000/api/webhooks/stripe
```

Lösche die temporäre Stripe-Konfiguration, sobald die Sandbox nicht mehr gebraucht wird. Committe sie niemals — und auch nicht `.env.stripe-sandbox.local`.

## Öffentliche URL

Setze den kanonischen Origin ohne Pfad, Query oder Fragment:

```dotenv
NEXT_PUBLIC_APP_URL="https://your-domain.example"
```

Aktualisiere die Callback-Einstellungen bei Google und Stripe jedes Mal, wenn sich die kanonische Domain ändert.
