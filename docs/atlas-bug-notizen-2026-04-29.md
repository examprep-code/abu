# Atlas-Bug-Notizen 2026-04-29

Diese Notiz haelt die Erkenntnis aus der defekten Atlas-Umsetzung fest, damit eine spaetere Neuimplementierung nicht denselben Fehler wiederholt.

## Wiederumsetzungs-Prompt

Setze die aus der defekten Version rekonstruierten Aenderungen phasenweise neu um und pushe jede abgeschlossene Phase separat. Arbeite nicht per Blindkopie aus der defekten Version, sondern uebernehme nur die fachlich sinnvollen Aenderungen. Reihenfolge:

1. Preview-Antworten isolieren, damit Admin-/Preview-Pruefungen keine echten Lernenden-Antworten ueberschreiben.
2. Freitext-Praemissen verknuepfen und Pflicht-/Referenzkontext sauber an die Bewertung uebergeben.
3. Immobilienlink-Kontext robust erkennen, besonders Schweizer Immobilienportale und direkte Listing-URLs.
4. Editor-Eingaben stabilisieren: Fokus, Auswahl, Debounce, Gap-Handling und Speichern erst nach den inhaltlichen Aenderungen.
5. Statusanzeigen, Versionsliste und Summary-Endpoint verbessern.
6. Erst ganz am Schluss die Atlas-/CI-/Layout-Schutzregeln anfassen.

## Atlas-/CI-Regel

Der wahrscheinliche Atlas-Bug hing mit zu breit wirkenden Layout-Regeln zusammen. Bei erneuter Umsetzung:

- Kein `:has(...)` fuer Shell-/Viewport-Erkennung verwenden.
- Keine globalen `html`- oder `body`-Regeln fuer Breite, Hoehe oder Overflow setzen.
- Keine grossflaechigen `!important`-Regeln ausserhalb eng begrenzter `.app`-/`.app--with-agent`-Selektoren.
- CI-Schutz nur anwenden, wenn wirklich Custom-CI-CSS aktiv ist.
- Regeln auf `.app`, `.app.app--with-agent` und konkrete Nachfahren wie `.workspace`, `.panel`, `.editor`, `.preview`, `.visual-layout` begrenzen.
- Nach jeder Layout-Aenderung explizit pruefen: `rg -n ":has\\(" abu-svelte/src/app.html abu-svelte/src/lib/ci.ts abu-svelte/src/routes/+page.svelte`.

## Referenz-Commits

- `9ebcc7a` Preview-Antworten isolieren
- `49e6fb3` Freitext-Praemissen verknuepfen
- `ec2c559` Immobilienlink-Kontext erkennen
- `55b5975` Editor-Eingaben stabilisieren
- `a938304` Statusanzeigen und Versionsliste verbessern
- `53f8dfc` CI-Layout defensiv begrenzen

## Pflichtchecks

- `php -l` fuer geaenderte PHP-Dateien
- `git diff --check`
- `npm run check`
- `npm run build`
