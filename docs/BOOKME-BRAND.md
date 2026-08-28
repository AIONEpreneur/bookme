# BookMe-Markensystem

BookMe ist die deutsche Community-Edition von [SnagTime](https://github.com/nateherkai/snagtime). Das Markensystem übernimmt die Farb- und Typografie-Grundlagen des Originals und ersetzt Wortmarke und Bildmarke.

## Positionierung

BookMe macht es schnell und unkompliziert, Zeit anzubieten, einen Link zu teilen und gebucht zu werden. Das Produkt soll leistungsfähig genug für ein Unternehmen wirken und freundlich genug für Solo-Selbstständige.

**Zentrales Versprechen:** Einfache Terminplanung ohne Ballast.

**Tagline:** Schnapp dir einen Termin. Werde gebucht.

**Stimme:** Direkt, nützlich, positiv und menschlich. Bevorzuge kurze Verben wie „Teilen", „Buchen" und „Verbinden". Vermeide aufgeblasene Produktivitätssprache.

## Logo

Die Marke kombiniert einen Kalender, einen hervorgehobenen Zeitslot und ein Bestätigungs-Häkchen. Sie soll Auswahl und Verbindlichkeit vermitteln, noch bevor der Name gelesen wird.

- Verwende das vollständige Logo (Lockup), wenn horizontaler Platz vorhanden ist.
- Verwende die quadratische Marke für Favicons, Avatare und kompakte Navigation.
- Halte den Schutzraum bei einem Viertel der Markenbreite.
- Färbe keine einzelnen Elemente um, verzerre die Marke nicht, füge keine Effekte hinzu und platziere sie nicht auf kontrastarmen Hintergründen.

Produktions-Assets:

- `/icon.svg` ist die quadratische App-Marke.
- `/bookme-logo.svg` ist das horizontale Lockup.

## Farben

| Rolle | Farbe | Hex |
| --- | --- | --- |
| Primär | Book Blue | `#2563EB` |
| Primär (Hover) | Deep Blue | `#1D4ED8` |
| Dunkle Flächen | Midnight | `#0B1F3A` |
| Primärer Text | Ink | `#10213D` |
| Hervorhebung | Sky | `#93C5FD` |
| Weiche Fläche | Blue Mist | `#EAF2FF` |
| Canvas | Cloud | `#F5F8FC` |
| Weiß | White | `#FFFFFF` |

Grün, Bernstein und Rot sind für Status- und Warnbedeutungen reserviert. Sie sind keine Markenakzente.

## Typografie und UI

Verwende Inter oder den nativen System-Sans-Serif-Stack. Überschriften sind kompakt und selbstbewusst mit enger Laufweite. Fließtext bleibt schlicht und gut lesbar. UI-Flächen sind weiß auf einem kühlen Cloud-Canvas, mit zurückhaltenden Rahmen, einer Midnight-Navigationsleiste und Blau, das für aktive Navigation, Fokus und primäre Aktionen reserviert ist.

## Benennung

Schreibe den Produktnamen als `BookMe`, mit großem B und M. Verwende weder `Book Me` noch `Bookme`. Interne technische Bezeichner (Event-Namen, Header, Datenbankrollen, Migrationsobjekte, Kompatibilitätsbezeichner) behalten ihre ursprünglichen Namen aus dem Upstream-Projekt, damit die Codebasis mit SnagTime vergleichbar und aktualisierbar bleibt.
