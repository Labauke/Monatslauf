# Monatslauf

Ein Sport-Wettbewerb für Freunde als installierbare Web-App (PWA). Alle tragen ihre Trainings ein, sammeln Punkte und sehen ihre selbst gebaute Figur auf der Rennbahn nach vorne laufen. Am Monatsende gewinnt, wer die meisten Punkte hat.

## Punkte

Punkte = Minuten × Faktor der Sportart.

| Sportart       | Faktor |
|----------------|-------:|
| Joggen         | 4      |
| Home-Training  | 2      |
| Klettern       | 1      |
| Bouldern       | 1      |
| Yoga           | 1      |
| Anderes        | 1      |
| Fahrrad        | 0,8    |

Die Faktoren stehen in `js/config.js` und lassen sich dort ändern. Da Punkte immer aus Minuten und Sportart berechnet werden, gilt eine Änderung auch rückwirkend.

## Funktionen

- Anmeldung nur mit Benutzernamen, ohne Passwort
- Figuren-Baukasten: Mensch, neun Tiere oder Roboter; dazu Hautfarbe, Frisur, Haarfarbe, Bart, Brille, Hut, Trikot, Schuhe und Zubehör
- Baukasten mit Vorschau in sechs Posen, Rückgängig, Würfeln pro Teil oder für alles; bei der Anmeldung reichen Figur und Trikotfarbe, der Rest lässt sich später umbauen
- Gesperrte Teile lassen sich vorher anprobieren; auswählen kann man sie erst mit genug Monatssiegen
- Monatssiege schalten Teile frei: 1 Sieg Pilotenbrille und goldene Schuhe, 2 Siege Umhang und Medaille, 3 Siege Krone
- Relative Rennbahn: Wer führt, steht vorne, alle anderen im Verhältnis dazu
- Die Figur zeigt die zuletzt trainierte Sportart (laufen, klettern, Hantel, Fahrrad, Yoga)
- Flammen für die Spitze, Sofa fürs Schlusslicht, Schlafen nach 3 Tagen Pause, Spinnweben nach einer Woche
- Überhol-Banner, Konfetti, Streaks, Siegerpodest und Siegerliste
- Installierbar auf dem Handy, funktioniert offline mit dem zuletzt geladenen Stand

## Einrichtung

### 1. Supabase (gemeinsame Datenbank)

1. Auf [supabase.com](https://supabase.com) kostenlos ein Konto und ein neues Projekt anlegen.
2. Im Projekt links **SQL Editor** öffnen, den kompletten Inhalt von `supabase/schema.sql` einfügen und **Run** klicken.
3. Unter **Project Settings → API** (bzw. **API Keys**) zwei Werte kopieren:
   - die **Project URL**, z. B. `https://abcdefghijkl.supabase.co`
   - den öffentlichen **anon**- bzw. **publishable**-Key
4. Beide Werte in `js/config.js` eintragen.

Den **service_role**- bzw. **secret**-Key niemals in die App eintragen.

Ohne diese Werte läuft die App im Demo-Modus und speichert nur im Browser des jeweiligen Geräts.

### 2. GitHub Pages (Veröffentlichung)

1. Auf GitHub ein neues Repository anlegen, z. B. `monatslauf`.
2. Diesen Ordner hochladen:
   ```bash
   git remote add origin https://github.com/DEIN-NAME/monatslauf.git
   git push -u origin main
   ```
3. Im Repository unter **Settings → Pages** bei „Build and deployment“ **Deploy from a branch** wählen, Branch `main`, Ordner `/ (root)`, speichern.
4. Nach ein bis zwei Minuten ist die App unter `https://DEIN-NAME.github.io/monatslauf/` erreichbar.

### 3. Aufs Handy

Den Link öffnen oder den QR-Code unten auf der Seite scannen.

- **Android (Chrome):** Auf „Als App installieren“ tippen, oder im Browsermenü „App installieren“ wählen.
- **iPhone (Safari):** Unten auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen.

## Lokal testen

```bash
python -m http.server 8080
```

Dann `http://localhost:8080` öffnen. Die App braucht einen Webserver, direkt als Datei geöffnet funktionieren Service Worker und QR-Code nicht.

## Updates

Nach einer Änderung einfach committen und pushen. Die App lädt ihre Dateien immer zuerst frisch aus dem Netz und nutzt den Cache nur ohne Verbindung. Wenn du Dateien hinzufügst oder umbenennst, trag sie in `sw.js` in die Liste `SHELL` ein und erhöhe `VERSION`.

Die Icons in `icons/` erzeugt `node tools/make-icons.js` aus einer Figur neu. Dafür muss Microsoft Edge oder Chrome installiert sein.

## Sicherheit

Die App hat bewusst keine Passwörter. Der öffentliche Supabase-Key steckt im Code der Seite. Wer die Adresse der App kennt, kann also Einträge anlegen, Figuren ändern und eigene Einträge des laufenden Monats löschen. Unter Freunden reicht das meist. Die Datenbank erlaubt serverseitig nur Einträge für den laufenden Monat und prüft Minuten, Namen und Farben.

## Ordner

| Pfad | Inhalt |
|------|--------|
| `index.html` | App-Gerüst |
| `css/app.css` | Gestaltung |
| `js/config.js` | Supabase-Zugang und Punktefaktoren |
| `js/figure.js` | Figuren (Zeichnung und Datenmodell) |
| `js/store.js` | Datenspeicher (Supabase oder Demo-Modus) |
| `js/app.js` | App-Logik und Figuren-Baukasten |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA |
| `supabase/schema.sql` | Datenbank-Setup |
| `tools/make-icons.js` | Icon-Erzeugung |
| `entwuerfe/` | Frühere Versionen und das Gipfelsturm-Konzept, nicht Teil der App |
