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

### 4. Push-Nachrichten (optional)

Die App kann Benachrichtigungen schicken: wenn dich jemand überholt, 3 Tage vor Monatsende und am letzten Tag mit deinem Platz, und als Erinnerung nach 3 bzw. 7 Tagen Pause. Wer will, bekommt zusätzlich jedes neue Training der anderen. Jede Person schaltet das in der Karte „Benachrichtigungen“ selbst an und aus. Auf iPhone und iPad geht das nur in der installierten App (ab iOS 16.4).

Verschickt werden die Nachrichten von einer Supabase Edge Function. Einrichtung:

1. **Schlüssel:** Für Web-Push braucht es ein Schlüsselpaar und ein Geheimnis. Der öffentliche Schlüssel steht schon in `js/config.js` (`vapidPublicKey`). Der geheime Schlüssel und das Geheimnis dürfen nie ins Repository. Neue Werte erzeugt `npx web-push generate-vapid-keys`. Dann den öffentlichen Schlüssel in `js/config.js` ersetzen, dazu ein beliebiges langes Zufallswort als Geheimnis wählen.
2. **Datenbank:** Im **SQL Editor** den Inhalt von `supabase/push.sql` einfügen, den Platzhalter `PUSH-SECRET` durch das Geheimnis ersetzen und **Run** klicken. Das legt die Tabelle für die Geräte an, einen Trigger für neue Einträge und einen täglichen Cron-Job (16:00 UTC).
3. **Edge Function:** Links **Edge Functions** → **Deploy a new function** → **Via Editor**. Name `push`, den Inhalt von `supabase/functions/push/index.ts` einfügen und deployen. Danach in den Einstellungen der Funktion **Verify JWT** (bzw. „Enforce JWT verification“) ausschalten. Die Funktion prüft stattdessen das Geheimnis.
4. **Secrets:** Unter **Edge Functions → Secrets** eintragen: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SECRET` und `VAPID_SUBJECT` (z. B. `mailto:deine@adresse.de`).
5. **Testen:** In der App „Benachrichtigungen aktivieren“, dann im SQL Editor die tägliche Runde von Hand auslösen:
   ```sql
   select net.http_post(
     url := (select value from public.push_config where key = 'url'),
     body := '{"type":"daily"}'::jsonb,
     headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', (select value from public.push_config where key = 'secret')));
   ```
   Nachrichten kommen dabei nur, wenn es einen Anlass gibt (3 Tage vor Monatsende, letzter Tag, 3 oder 7 Tage Pause). Was passiert ist, steht unter **Edge Functions → push → Logs**.

Die Punktefaktoren stehen in der Edge Function ein zweites Mal. Wer sie in `js/config.js` ändert, muss sie dort auch anpassen.

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
| `supabase/push.sql`, `supabase/functions/push/` | Push-Nachrichten (Datenbank und Edge Function) |
| `tools/make-icons.js` | Icon-Erzeugung |
| `entwuerfe/` | Frühere Versionen und das Gipfelsturm-Konzept, nicht Teil der App |
