# SnagTime mit Codex oder Claude Code einrichten

Mit dieser Anleitung übernimmt ein KI-Coding-Assistent die technische Einrichtung, während du die Kontrolle über Konten, Zugangsdaten, Zahlungen und Deployment-Entscheidungen behältst.

Starte mit der kostenlosen lokalen Demo. Sie braucht keine Zugangsdaten für Google, Stripe, SMTP, Hosting oder PostgreSQL. Füge Integrationen erst hinzu, wenn der lokale Buchungsablauf funktioniert.

## Diesen Prompt kopieren

Füge den folgenden Prompt in Codex oder Claude Code ein. Falls der Assistent nicht bereits in einem Klon des Repositories arbeitet, gib `https://github.com/aionepreneur/bookme` mit dem Prompt an.

```text
Richte SnagTime für mich ein, aus https://github.com/aionepreneur/bookme.

Lies README.md, docs/AI-SETUP.md, docs/INTEGRATION-SETUP.md, docs/DEPLOYMENT.md und SECURITY.md, bevor du Änderungen machst.

Beginne mit der lokalen Demo ohne Zugangsdaten. Prüfe, ob Git, Node.js 20.9 oder neuer und npm verfügbar sind. Klone das Repository falls nötig, führe den unterstützten Setup-Ablauf aus, validiere ihn mit npm run setup:check, bereite die SQLite-Datenbank vor und starte die App. Nenne mir die lokale URL und wo die generierten Zugangsdaten angezeigt wurden. Prüfe, dass der Health-Endpunkt und die Anmeldeseite laden.

Sicherheitsregeln:
- Gib niemals .env.local oder irgendeinen Credential-Wert aus, fasse ihn nicht zusammen, übertrage ihn nicht und committe ihn nicht.
- Bitte mich niemals, Secrets in den Chat einzufügen. Nenne mir den exakten Namen der Umgebungsvariable und lass mich den Wert direkt in .env.local oder den Secret-Manager meines Hosters eintragen.
- Erfinde niemals Anbieter-Zugangsdaten und schwäche niemals Validierungen ab, damit das Setup durchläuft.
- Aktiviere niemals den Stripe-Live-Modus. Diese Version unterstützt ausschließlich den Stripe-Testmodus.
- Führe niemals einen Datenbank-Reset aus, lösche keine Daten, mache die App nicht öffentlich zugänglich, kaufe keinen Dienst und lege keine Cloud-Ressourcen an, ohne meine ausdrückliche Zustimmung.

Wenn die kostenlose lokale Demo läuft, frage mich, welchen optionalen Schritt ich möchte: Google Calendar, SMTP-E-Mail, Stripe-Testzahlungen oder öffentliches Deployment. Kümmere dich nur um die Option, die ich auswähle.

Wenn ein Anbieter eine menschliche Aktion erfordert, halte an und gib mir:
1. Die Anbieter-Seite, die ich öffnen muss.
2. Die exakte Einstellung oder das Credential, das ich anlegen muss.
3. Die exakte Callback- oder Webhook-URL, die ich eintragen muss.
4. Den Namen der Umgebungsvariable, in die der Wert gehört.
5. Einen sicheren Prüfschritt, der den Wert nicht offenlegt.

Warte, bis ich jeden menschlichen Checkpoint bestätigt habe, und mach dann weiter. Berichte am Ende, was funktioniert, was nur lokal bleibt, welche Integrationen aktiv sind und welche laufenden Hosting-Kosten oder Betriebspflichten es gibt.
```

## Was der Assistent zuerst fragen sollte

Der Assistent braucht für die lokale Einrichtung nur ein paar Entscheidungen ohne Secrets:

1. Wohin soll das Repository geklont werden?
2. Welche E-Mail-Adresse soll die Gastgeber:in in der lokalen Demo nutzen?
3. Soll das Setup ein starkes Demo-Passwort generieren, oder gibst du selbst eins direkt im Terminal ein?

Der Assistent sollte keine Zugangsdaten für Google, Stripe, SMTP, Datenbank oder Hosting anfragen, bevor der kostenlose lokale Buchungsablauf funktioniert.

## Checkpoints für die lokale Einrichtung

### 1. Voraussetzungen

Der Assistent sollte prüfen:

```bash
git --version
node --version
npm --version
```

Node.js 24 ist die verifizierte Laufzeitumgebung. Node.js 20.9 oder neuer wird unterstützt.

### 2. Lokale Konfiguration erstellen

Im Hauptverzeichnis des Repositories:

```bash
npm run setup -- --email you@example.com
```

Der Befehl erstellt die von Git ignorierte `.env.local`, generiert unabhängige Anwendungs-Secrets und zeigt das generierte lokale Passwort einmalig an. Speichere dieses Passwort in deinem Passwort-Manager.

Falls `.env.local` bereits existiert, muss der Assistent die Datei erhalten. Er darf `--force` nur verwenden, wenn du dem Ersetzen der Datei ausdrücklich zustimmst.

### 3. Validieren, ohne Secrets offenzulegen

```bash
npm run setup:check
```

Bei Erfolg meldet der Befehl, dass der SnagTime-Free-Demo-Preflight bestanden wurde. Er prüft die erforderlichen Werte und die Stärke der Secrets, ohne konfigurierte Werte auszugeben.

### 4. App vorbereiten und starten

```bash
npm run demo:free
```

Das installiert die Abhängigkeiten, generiert den SQLite-Client, wendet Migrationen an, legt das Konto der Gastgeber:in an und startet SnagTime unter [http://localhost:3000](http://localhost:3000).

Der Assistent sollte prüfen:

- `http://localhost:3000/api/health/live` antwortet erfolgreich.
- Die Anmeldeseite lädt.
- Die generierten Zugangsdaten der Gastgeber:in funktionieren.
- Ein öffentlicher Buchungslink kann erstellt und geöffnet werden.

Der lokale Posteingang, der lokale Kalender-Adapter und der Zahlungs-Stub sind Absicht. Sie machen die erste Einrichtung kostenlos und ohne Zugangsdaten möglich.

## Menschliche Checkpoints für optionale Integrationen

### Google Calendar

Du musst dich bei Google Cloud anmelden, ein Projekt erstellen oder auswählen, die Google Calendar API aktivieren, den OAuth-Zustimmungsbildschirm konfigurieren und einen Web-OAuth-Client anlegen. Der Assistent kann jedes Feld erklären und die Callback-URL prüfen, aber das Google-Konto und den Zustimmungsablauf musst du selbst kontrollieren.

Folge der [Google-Calendar-Einrichtung](INTEGRATION-SETUP.md#google-calendar).

### Transaktionale E-Mails

Du musst einen SMTP-Anbieter wählen, eine Absender-Domain verifizieren und Anbieter-Zugangsdaten anlegen. Der Assistent kann die Variablennamen setzen und die Form der Konfiguration prüfen, aber er kann weder Zustellbarkeit garantieren noch DNS-Eigentumsprüfungen für dich abschließen.

Folge der [Einrichtung für transaktionale E-Mails](INTEGRATION-SETUP.md#transaktionale-e-mails).

### Stripe-Testzahlungen

Du musst dich bei Stripe anmelden, den Testmodus verwenden, Test-Zugangsdaten holen und einen Test-Webhook anlegen oder Stripe CLI lokal laufen lassen. Diese Version lehnt Stripe-Live-Schlüssel und Live-Webhook-Events ab.

Folge der Anleitung für [Stripe-Testzahlungen](INTEGRATION-SETUP.md#stripe-testzahlungen).

### Öffentliches Deployment

Ein öffentliches Deployment ist eine fortgeschrittene Self-Hosting-Aufgabe. Es erfordert einen Linux- oder kompatiblen Container-Host, HTTPS, PostgreSQL 18 mit persistentem Speicher und verifiziertem TLS, getrennte Web- und Worker-Services, Secrets, Backups und Monitoring.

ChatGPT Sites ist nicht kompatibel. Vercel wird nicht ohne Weiteres unterstützt. Lass einen Assistenten keine Infrastruktur auswählen oder kaufen, ohne dass er dir vorher die Architektur und die geschätzten laufenden Kosten zeigt.

Folge der [Deployment-Anleitung](DEPLOYMENT.md).

## Sicherer Troubleshooting-Prompt

Falls die Einrichtung fehlschlägt, gib dem Assistenten diesen Folge-Prompt:

```text
Diagnostiziere den fehlgeschlagenen SnagTime-Setup anhand der Befehlsausgaben, der versionierten Quelldateien und des dokumentierten Setup-Vertrags. Gib keine Credential-Werte aus und lies keine. Berichte die fehlgeschlagene Phase, die wahrscheinliche Ursache und die kleinste sichere Korrektur. Erhalte .env.local und alle vorhandenen Daten. Setze die Datenbank nicht zurück und installiere nicht alles neu, ohne vorher zu erklären warum und meine Zustimmung zu bekommen.
```

## Wann ist es fertig?

Die lokale Einrichtung ist abgeschlossen, wenn:

- `npm run setup:check` besteht.
- SnagTime lokal öffnet und sich die Gastgeber:in anmelden kann.
- Die Gastgeber:in eine Terminart erstellen und deren öffentlichen Buchungslink öffnen kann.
- Eine Testbuchung erstellt, umgebucht und storniert werden kann.
- Der Assistent klar kennzeichnet, was lokale Adapter und was verbundene externe Dienste sind.
- `.env.local` weiterhin von Git ignoriert wird und kein Credential in der Git-Historie oder im Chat auftaucht.

Eine Integration ist erst abgeschlossen, wenn ihre anbieterspezifischen Prüfschritte bestanden sind. Ein öffentliches Deployment ist erst abgeschlossen, wenn HTTPS, Backups, Worker-Verarbeitung, E-Mail-Zustellung an Gastgeber:in und Gast, das Google-Frei/Belegt-Verhalten und die Stripe-Test-Webhooks alle verifiziert wurden.
