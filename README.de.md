# Dashboard Layout Card V2

[English](README.md) | Deutsch | [Français](README.fr.md)

Parallel installierbarer V2-Fork von [thomasloven/lovelace-layout-card](https://github.com/thomasloven/lovelace-layout-card) mit zusätzlichen Dashboard-Ansichts-Funktionen für Home Assistant.

Das Originalprojekt steht unter MIT-Lizenz. Dieser Fork behält die Attribution bei und registriert eigene `*-v2` Custom Elements. Dadurch kann die Card neben der originalen `layout-card` installiert werden, ohne diese zu überschreiben.

## Funktionen

- eigene V2-Layouts für Masonry, Sections, Horizontal, Vertical und Grid
- optionales seitliches Dashboard-Menü links oder rechts
- automatischer Icon-only-Modus auf kleinen Displays und manueller Icon-only-Modus für Tablet-/Kiosk-Dashboards
- optionale Submenü-Spalte als zweite Icon-Spalte neben dem Hauptmenü
- Home-Eintrag, Unterseiten/Subviews und neue Unterseiten standardmäßig als Sections V2
- Theme-Übernahme von der Hauptansicht
- digitale oder analoge Uhr, Datum und Wochentag
- Benachrichtigung über Text-Helper und bis zu vier Statuswerte im Menü
- globale Styles, Farben je Button und bis zu 20 Farbfavoriten
- Opacity-Regler für Menü-, Inhalts-, Benachrichtigungs-, Status- und Trennerrahmen
- YAML-Backup-Export direkt im Editor
- Debug-Sprachauswahl im Editor für Dokumentations-Screenshots und Tests
- optionales Ausblenden von Home-Assistant-Header und Sidebar für ausgewählte Benutzer

## Installation

Dieses Repository in HACS als benutzerdefiniertes Frontend-Repository hinzufügen:

```text
https://github.com/rockbaer2007/lovelace-layout-card-v2
```

Nach der Installation sollte Home Assistant diese Ressource laden:

```text
/hacsfiles/lovelace-layout-card-v2/dashboard-layout-card-v2.js
```

Wenn nach einem Update noch eine alte Version angezeigt wird:

- HACS-Repositories aktualisieren
- Browser-Cache leeren
- Dashboard hart neu laden

## Registrierte Typen

Ansichten:

- `custom:sections-layout-v2`
- `custom:masonry-layout-v2`
- `custom:horizontal-layout-v2`
- `custom:vertical-layout-v2`
- `custom:grid-layout-v2`

Cards und Helper:

- `custom:dashboard-layout-card-v2`
- `custom:layout-card-v2`
- `custom:layout-break-v2`
- `custom:gap-card-v2`

## Benötigte Helper

Nur die aktivierten Funktionen benötigen Helper. Diese werden in Home Assistant unter **Einstellungen > Geräte & Dienste > Helfer** erstellt.

| Entity | Helper-Typ | Zweck | Pflicht? |
| --- | --- | --- | --- |
| `input_text.dashboard_notification` | Text | Optionaler Benachrichtigungstext. Leer, `unknown` und `unavailable` blenden die Meldung aus. | Nur wenn `menu.notify.enabled` genutzt wird. |
| `input_boolean.dashboard_holiday` | Umschalter | Optionales Tages-Symbol für Feiertage. | Nur wenn das Tages-Symbol auf Feiertage reagieren soll. |
| `input_boolean.dashboard_birthday` | Umschalter | Optionales Tages-Symbol für Geburtstage. | Nur wenn das Tages-Symbol auf Geburtstage reagieren soll. |
| `input_boolean.dashboard_christmas` | Umschalter | Optionales Tages-Symbol für Advent/Weihnachten. | Nur wenn das Tages-Symbol auf Advent/Weihnachten reagieren soll. |

Statuswerte benötigen keine speziellen Helper. Sie können jede lesbare Home-Assistant-Entity verwenden, zum Beispiel Sensoren, Binary-Sensoren oder Template-Sensoren.

## Menü, Submenüs und Farben

Bis einschließlich 600 px Bildschirmbreite zeigen die Menübuttons automatisch nur Icons. Der Icon-only-Modus kann zusätzlich manuell aktiviert werden, zum Beispiel für Kiosk-Tablets oder Wanddisplays.

Jeder Hauptmenüeintrag kann ein Submenü besitzen. Das Submenü erscheint als eigene Icon-Spalte neben dem Hauptmenü und zeigt nur die Unterseiten des aktuell gewählten Hauptmenüpunktes. Der erste Submenübutton kann als Startseite dieses Hauptmenüpunktes dienen oder deaktiviert werden, damit direkt zur ersten Unterseite gewechselt wird.

Home-, Hauptmenü- und Submenüeinträge können eigene Farben definieren: Icon-Farbe, aktive Icon-Farbe, Icon-Hintergrund, aktiver Icon-Hintergrund, Button-Farbe und aktive Button-Farbe. Leere Felder verwenden weiterhin den globalen Stil.

## Editor-Tabs

| Tab | Optionen |
| --- | --- |
| Menu | Menüposition, Menütitel und globaler Icon-only-Modus. |
| Home page | Home-Eintrag, Titel, Pfad, Icon, Home-Farben, Sections-V2-Spalten und Theme-Übernahme. |
| Display | Uhr, Datum, Wochentag, Uhrfarben und Tages-Symbol-Helper. |
| Pages | Hauptseiten, Abstände, Trenner, Layouts, Farben je Eintrag und Submenü-Verhalten. |
| Submenu | Unterseiten der gewählten Hauptseite mit Layout und Farben. |
| Messages | Benachrichtigung, Statuswerte, Rahmenfarben und Opacity. |
| Styles Global | Globale Farben, Größen, Icon-Form, Hintergründe, Opacity und 3D-Effekte. |
| Colors | Bis zu 20 wiederverwendbare Farbfavoriten. |
| Backup | YAML-Export des aktuellen Dashboard-Standes auf den eigenen PC. |
| Advanced | Home-Assistant-Chrome, sichtbare Benutzer, Debug und JSON-Spezialoptionen. |

## Debug-Sprachauswahl

Für Dokumentations-Screenshots oder Sprachtests kann die angezeigte Sprache im Editor unter **Advanced > Special options / edit JSON > Debug** oder direkt per YAML gesetzt werden.

```yaml
debug:
  language: de # leer/default, de, en oder fr
```

Mit leerem `debug.language` nutzt Dashboard Layout Card V2 automatisch die Home-Assistant- oder Browser-Sprache und fällt bei Bedarf auf Englisch zurück.

## Hintergrundbilder

Menü-Hintergründe sollten in Home Assistant im Ordner `www` liegen, zum Beispiel:

```text
/config/www/image/back2.jpg
```

Im Editor wird dann dieser Pfad verwendet:

```text
/local/image/back2.jpg
```

Für ein seitliches Menü funktionieren Hochformat-Bilder am besten. Ein praktisches Seitenverhältnis ist ungefähr `1:2,5` Breite:Höhe. Bitte nur eigene Bilder oder Bilder mit passender freier/Open-Source-Lizenz verwenden.

## Status

Dieser V2-Fork ist aktiv und auf Dashboard-Ansichten in Home Assistant ausgerichtet. Die API kann sich noch ändern, während die V2-Funktionen weiter verfeinert werden.

## Attribution

Basierend auf [thomasloven/lovelace-layout-card](https://github.com/thomasloven/lovelace-layout-card), lizenziert unter der MIT-Lizenz.
