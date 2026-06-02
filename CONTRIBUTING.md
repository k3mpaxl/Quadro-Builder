# Contributing · Mitmachen

[🇩🇪 Deutsch](#-deutsch) · [🇬🇧 English](#-english)

---

## 🇩🇪 Deutsch

Danke für dein Interesse am Quadro Builder! Jeder Beitrag ist willkommen –
ob Bugfix, neue Funktion, Verbesserung der Teile-Daten oder Dokumentation.

### Setup

```bash
git clone https://github.com/DEIN_NAME/Quadro-Builder.git
cd Quadro-Builder
python serve.py   # öffnet http://127.0.0.1:8000/web/index.html
```

Kein Build-Step, kein npm, keine Abhängigkeiten – nur Python 3 (Standardbibliothek).

### Wo was steckt

| Was du ändern möchtest | Relevante Datei(en) |
|---|---|
| Neue Teile / Preise / Maße | `data/parts.json` |
| UI-Texte (Deutsch/Englisch) | `web/js/i18n.js` |
| Toolbar, Panels, Tastatur | `web/js/ui.js` |
| Bau-Logik (Setzen, Löschen) | `web/js/builder.js` |
| 3D-Darstellung | `web/js/scene.js` |
| Datenmodell (Knoten/Kanten) | `web/js/model.js` |
| Stückliste & Kupplungstypen | `web/js/bom.js` |
| Aufbauplan | `web/js/buildplan.js` |
| Persistenz (Save/Load) | `web/js/storage.js` |
| Styling | `web/css/style.css` |
| Konstanten / Richtungen | `web/js/config.js` |

### Teile-Daten ergänzen

Die einfachste Art beizutragen: Teile in `data/parts.json` ergänzen oder korrigieren.

- **Neues gerades Rohr:** Eintrag mit `"buildable": true` und `"length_cm"` → erscheint automatisch als Button.
- **Neue baubare Platte:** Eintrag mit `"buildable": true`, `"w"` und `"h"` (in cm).
- **Preise/Maße korrigieren:** Direkt im JSON bearbeiten. Bitte Quelle im Commit angeben (z. B. quadroshop.com, Stand Datum).

### Übersetzungen

Alle UI-Texte sind in `web/js/i18n.js` in zwei Dictionaries (`de` und `en`).
Neue Strings bitte in **beide** eintragen.

### Code-Stil

- Reines JavaScript (ES2022+), keine Frameworks, kein Build-Step.
- `model.js`, `bom.js` und `buildplan.js` müssen **frei von Three.js und DOM** bleiben – sie sollen in Node.js testbar sein.
- Kommentare auf Deutsch, Variablen- und Funktionsnamen auf Englisch.
- Keine neuen externen Abhängigkeiten ohne vorherige Diskussion.

### Verifikation

```bash
# JSON-Katalog auf Gültigkeit prüfen
python -m json.tool data/parts.json > /dev/null && echo "OK"

# JavaScript-Syntax prüfen (kein Three.js/DOM nötig)
node --check web/js/model.js
node --check web/js/bom.js
node --check web/js/buildplan.js
```

### Pull Request erstellen

1. Fork erstellen und Branch anlegen: `git checkout -b feature/meine-aenderung`
2. Änderungen committen mit aussagekräftiger Nachricht (auf Deutsch oder Englisch)
3. Pull Request öffnen – kurze Beschreibung was und warum

Kleine, fokussierte PRs werden bevorzugt.

### Bugs melden

[Issue öffnen](../../issues/new/choose) und die Bug-Report-Vorlage ausfüllen.

---

## 🇬🇧 English

Thanks for your interest in Quadro Builder! Every contribution is welcome –
whether a bug fix, new feature, improvement to the parts data or documentation.

### Setup

```bash
git clone https://github.com/YOUR_NAME/Quadro-Builder.git
cd Quadro-Builder
python serve.py   # opens http://127.0.0.1:8000/web/index.html
```

No build step, no npm, no dependencies – just Python 3 (standard library).

### Where things live

| What you want to change | Relevant file(s) |
|---|---|
| New parts / prices / dimensions | `data/parts.json` |
| UI strings (German / English) | `web/js/i18n.js` |
| Toolbar, panels, keyboard | `web/js/ui.js` |
| Build logic (place, delete) | `web/js/builder.js` |
| 3D rendering | `web/js/scene.js` |
| Data model (nodes/edges) | `web/js/model.js` |
| BOM & connector types | `web/js/bom.js` |
| Assembly plan | `web/js/buildplan.js` |
| Persistence (save/load) | `web/js/storage.js` |
| Styling | `web/css/style.css` |
| Constants / directions | `web/js/config.js` |

### Adding parts data

The easiest way to contribute: add or correct entries in `data/parts.json`.

- **New straight tube:** entry with `"buildable": true` and `"length_cm"` → appears automatically as a button.
- **New buildable panel:** entry with `"buildable": true`, `"w"` and `"h"` (in cm).
- **Correcting prices/dimensions:** edit directly in the JSON. Please state the source in the commit (e.g. quadroshop.com, date).

### Translations

All UI strings are in `web/js/i18n.js` in two dictionaries (`de` and `en`).
Please add new strings to **both**.

### Code style

- Pure JavaScript (ES2022+), no frameworks, no build step.
- `model.js`, `bom.js` and `buildplan.js` must remain **free of Three.js and DOM** – they should be testable in Node.js.
- Comments in German, variable and function names in English.
- No new external dependencies without prior discussion.

### Verification

```bash
# Check JSON catalogue validity
python -m json.tool data/parts.json > /dev/null && echo "OK"

# Check JavaScript syntax (no Three.js/DOM needed)
node --check web/js/model.js
node --check web/js/bom.js
node --check web/js/buildplan.js
```

### Creating a pull request

1. Fork the repo and create a branch: `git checkout -b feature/my-change`
2. Commit changes with a meaningful message (German or English)
3. Open a pull request – short description of what and why

Small, focused PRs are preferred.

### Reporting bugs

[Open an issue](../../issues/new/choose) and fill in the bug report template.
