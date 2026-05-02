# Projektdokumentation ABU

## Zweck des Projekts

ABU ist eine Lernplattform für allgemeinbildenden Unterricht. Das System richtet sich primär an Lehrpersonen und deckt drei Hauptaufgaben ab:

1. Arbeitsblätter erstellen und verwalten
2. Arbeitsblätter Klassen zuweisen
3. Antworten von Lernenden erfassen, bewerten und auswerten

Inhaltlich verbindet das Projekt klassische Lernplattform-Funktionen mit KI-Unterstützung:

- Lehrpersonen verwalten Schulen, Klassen und Lernende.
- Arbeitsblätter werden als HTML-basierte "Sheets" gespeichert.
- Lernende öffnen zugewiesene Sheets über einen Code, nicht über ein klassisches Benutzerkonto.
- Antworten werden gespeichert und können automatisch durch ein LLM grob klassifiziert werden.
- Lehrpersonen können Antworten gesammelt pro Sheet und Klasse prüfen.
- Zusätzlich gibt es einen KI-Agenten für Navigation, Analyse und einen Material-Import von `pdf`/`docx` zu neuen Sheets.

## Fachlicher Kern

Das System ist fachlich um vier Ebenen aufgebaut:

1. Organisation: `user`, `school`, `classroom`
2. Zielgruppe: `learner`
3. Lerninhalt: `sheet`, `classroom_sheet`
4. Bearbeitung und Auswertung: `answer`

Dazu kommen technische bzw. erweiternde Bereiche:

- `log`: einfache Protokollierung von Antwortbewertung/KI-Rückgaben
- `agent_chat_log`: persistente Protokollierung der Agent-Interaktionen
- `migration`: technische Tabelle des Datian-Frameworks für Schema-Änderungen

## Datenbankmodell

### 1. `user`

Der `user` ist die Lehrperson oder ein Admin. Fast alle fachlichen Daten sind einem `user` zugeordnet. Damit bildet `user` den Mandanten des Systems.

Wichtige Felder:

- `id`: technische Primar-ID
- `role`: Rollenmodell, im Code verwendet für normale User, noch nicht aktivierte User und Admins
- `email`, `password`: Login-Daten
- `token`, `valid_until`: API-Session für das Frontend
- `ai_*`: Nutzungs- und Kostenzähler für KI-Aufrufe

Logische Rolle:

- Ein `user` besitzt Sheets, Schulen, Klassen und Lernende.
- Zugriffe im Backend werden fast immer auf `user = eingeloggter User` eingeschränkt.

### 2. `school`

`school` bildet eine organisatorische Schuleinheit der Lehrperson ab. Sie dient nicht nur der Strukturierung, sondern auch dem visuellen Branding.

Wichtige Felder:

- `user`: Besitzer
- `name`: Schulname
- `ci_css`: individuelles CSS für CI/Branding
- `prompt`: zusätzlicher Kontext für KI-Funktionen

Logische Rolle:

- Eine Schule kann mehrere Klassen enthalten.
- Die CI wird bis in das Lernendenportal und die öffentliche Sheet-Ansicht durchgereicht.

### 3. `classroom`

`classroom` ist die zentrale Unterrichtseinheit.

Wichtige Felder:

- `user`: Besitzer
- `school`: optionale Zuordnung zu einer Schule
- `name`, `year`, `profession`: fachliche Stammdaten
- `notes`: freie Notizen
- `prompt`: KI-Kontext für diese Klasse

Logische Rolle:

- Eine Klasse gehört genau einem User.
- Eine Klasse kann optional einer Schule zugeordnet sein.
- Eine Klasse hat viele Lernende.
- Einer Klasse können viele Sheets zugewiesen werden.

### 4. `learner`

`learner` repräsentiert eine lernende Person. Lernende haben kein Passwortkonto, sondern einen Identifikationscode.

Wichtige Felder:

- `user`: Besitzer auf Lehrpersonen-Seite
- `classroom`: Zugehörige Klasse
- `name`, `email`, `phone`
- `code`: 12-stelliger Login-/Zugriffscode
- `notes`, `prompt`

Logische Rolle:

- Lernende werden von Lehrpersonen angelegt.
- Der `code` ist die zentrale Brücke zwischen Admin-Welt und Lernendenportal.
- Über den Code werden Zuweisungen und eigene Antworten geladen.

### 5. `sheet`

`sheet` ist das eigentliche Arbeitsblatt. Inhaltlich ist dies das Kernobjekt der Lernplattform.

Wichtige Felder:

- `user`: Besitzer
- `key`: fachlicher, stabiler Sheet-Schlüssel
- `name`: Anzeigename
- `content`: HTML-Inhalt des Arbeitsblatts
- `prompt`: Kontext für KI/Folgebearbeitung
- `is_current`: kennzeichnet die aktive Version

Besonderheit: Versionierung

Ein Sheet ist fachlich nicht über `id`, sondern über `key` definiert. Jede Änderung erzeugt im Backend eine neue Zeile mit derselben `key`. Die aktuelle Version wird über `is_current = 1` markiert.

Das bedeutet:

- `id` = technische Versions-ID
- `key` = fachliche Identität des Arbeitsblatts

Diese Entscheidung ist zentral für das gesamte Projekt, weil Zuweisungen und Antworten auf `sheet.key` referenzieren und dadurch auch bei neuen Versionen stabil bleiben.

### 6. `classroom_sheet`

`classroom_sheet` ist die Zuordnungstabelle zwischen Klassen und Sheets. Fachlich ist das die Aufgabenplanung bzw. Freigabe.

Wichtige Felder:

- `user`: Besitzer
- `classroom`: Klasse
- `sheet_key`: referenziertes Sheet über den stabilen `sheet.key`
- `status`: z. B. `aktiv`, `freiwillig`, `archiviert`
- `assignment_form`: `personal` oder `anonym`

Logische Rolle:

- Diese Tabelle bildet die n:m-Beziehung zwischen `classroom` und `sheet`.
- Hier wird nicht nur verknüpft, sondern auch gesteuert, wie ein Blatt für eine Klasse verwendet wird.
- `assignment_form` entscheidet, ob Antworten personenbezogen oder anonym laufen.

### 7. `answer`

`answer` speichert einzelne Antworten von Lernenden auf ein Sheet.

Wichtige Felder:

- `key`: Schlüssel der konkreten Lücke / Frage im Sheet
- `sheet`: referenziertes Arbeitsblatt über `sheet.key`
- `value`: gegebene Antwort
- `user`: Lernendenkennung oder anonymer Laufzeit-Identifier
- `classroom`: optionale Klassen-ID
- `classification`: grobe KI-Bewertung, im Projekt typischerweise `0`, `500`, `1000`
- `created_at`, `updated_at`

Logische Rolle:

- Eine Antwort gehört logisch zu einem Sheet und zu einem konkreten Feld innerhalb des Sheets.
- Antworten werden nicht gegen `sheet.id`, sondern gegen `sheet.key` gespeichert.
- Dadurch bleiben Antworten auch bei neuen Sheet-Versionen referenzierbar.

Besonderheit bei personenbezogen vs. anonym:

- Bei `personal` wird für Lernende typischerweise deren `learner.code` als `answer.user` verwendet.
- Bei `anonym` wird ein anonymer Laufzeit-Token verwendet.

### 8. `log`

`log` ist eine einfache technische Logtabelle.

Inhalt:

- gespeicherter Request
- gespeicherte KI-Antwort

Logische Rolle:

- Debugging und Nachvollziehbarkeit für die automatische Antwortbewertung

### 9. `agent_chat_log`

`agent_chat_log` ist die ausgebautere Logtabelle für den KI-Agenten.

Wichtige Inhalte:

- Nutzerprompt
- Agent-Ablauf (`agent_flow`)
- finale Antwort
- Intent-/Navigationsinformationen
- Bewertung durch den Benutzer

Logische Rolle:

- Qualitätssicherung für den Agenten
- Nachvollziehbarkeit von Entscheidungen und Modellausgaben

## Logische Zusammenhänge

### Mandantenlogik

Das Projekt ist stark mandantenorientiert. Fast alle fachlichen Tabellen tragen ein `user`-Feld. Dadurch gehören Daten immer einer Lehrperson bzw. einem Admin-Kontext.

Praktische Folge:

- Ein User sieht in der Regel nur seine eigenen Schulen, Klassen, Lernenden und Sheets.
- Admins können teilweise breiter sehen, aber die Fachlogik ist klar um Besitzverhältnisse gebaut.

### Organisationslogik

Die organisatorische Struktur ist:

`user -> school -> classroom -> learner`

Dabei ist `school` optional. Eine Klasse kann also auch ohne Schule existieren. Fachlich ist `classroom` die wichtigste organisatorische Einheit, weil dort Zuweisungen und Lernende zusammenlaufen.

### Inhaltslogik

Die Inhaltsstruktur ist:

`user -> sheet`

Ein Sheet ist ein HTML-Arbeitsblatt mit interaktiven Spezialelementen wie Lücken, Freitexten oder Umfragen. Es wird im Editor gepflegt und versioniert gespeichert.

### Zuweisungslogik

Die Unterrichtsplanung ist:

`classroom <-> classroom_sheet <-> sheet`

Das ist kein reiner technischer Join, sondern ein fachliches Steuerobjekt:

- Welche Klasse bekommt welches Sheet?
- Ist es aktiv, freiwillig oder archiviert?
- Erfolgt die Bearbeitung personalisiert oder anonym?

### Bearbeitungslogik

Die Bearbeitung läuft so:

1. Lernende melden sich mit `learner.code` an.
2. Das System lädt über `sheet/public-list` die für ihre Klasse freigegebenen Sheets.
3. Ein Sheet wird über `sheet/public` geladen.
4. Einzelne Antworten werden als `answer` gespeichert.
5. Das Backend kann direkt beim Speichern eine KI-Klassifikation erzeugen.

### Auswertungslogik

Lehrpersonen betrachten Antworten gesammelt nach:

- Sheet
- Klasse
- Lernendenkennung

Die Review-Ansicht visualisiert Antworten direkt an den Lücken des Sheets. Dadurch ist die Plattform weniger ein klassisches Testsystem und mehr ein arbeitsblattorientiertes Korrektur- und Übersichtssystem.

## Wichtigste fachliche Designentscheidungen

### 1. Lernende ohne klassisches Benutzerkonto

Lernende verwenden einen Code statt E-Mail/Passwort. Das senkt die Einstiegshürde und passt zu Unterrichtssituationen mit schnellen Zugriffen.

### 2. Sheets werden über `key` versioniert

Das ist eine der wichtigsten Architekturentscheidungen des Projekts.

Vorteile:

- neue Versionen können gespeichert werden, ohne Zuweisungen neu zu verdrahten
- Antworten bleiben logisch beim selben Arbeitsblatt
- die Plattform kann Bearbeitungsstände historisieren

### 3. Antworten referenzieren fachliche Identitäten

`answer` verweist auf:

- das Sheet über `sheet.key`
- das konkrete Feld über `answer.key`
- den Bearbeiter über `answer.user`

Dadurch ist die Antwortspeicherung sehr flexibel, aber auch weniger strikt relational als bei einem voll normalisierten Prüfungssystem.

### 4. KI ist Zusatzschicht, nicht Kernspeicher

Die KI-Funktionen erweitern das System, ersetzen aber das Fachmodell nicht.

KI wird genutzt für:

- automatische Grobbewertung von Antworten
- Material-Import von `pdf`/`docx` in neue Sheets
- Agent-Navigation und Analyse im Admin-Frontend

Das Kernmodell bleibt trotzdem klassisch relational.

## Typische End-to-End-Ablaufe

### Ablauf A: Lehrperson organisiert Unterricht

1. User registriert sich und loggt sich ein.
2. User legt optional eine Schule an.
3. User legt eine oder mehrere Klassen an.
4. User legt Lernende je Klasse an.
5. User erstellt oder importiert Sheets.
6. User weist Sheets Klassen über `classroom_sheet` zu.

### Ablauf B: Lernende bearbeiten ein Arbeitsblatt

1. Lernende loggen sich mit ihrem Code ein.
2. Das System erkennt die Klasse und optional die Schul-CI.
3. Zuweisbare Sheets werden geladen.
4. Ein Sheet wird angezeigt.
5. Antworten werden einzeln gespeichert und können sofort klassifiziert werden.

### Ablauf C: Lehrperson wertet aus

1. Lehrperson öffnet ein Sheet im Review-/Antwortmodus.
2. Antworten werden pro Klasse und Lernendenkontext geladen.
3. Klassifikationen können geprüft und manuell angepasst werden.
4. Der aktuelle Lernstand wird direkt im Kontext des Arbeitsblatts sichtbar.

### Ablauf D: Material wird KI-gestützt umgewandelt

1. Lehrperson lädt `pdf` oder `docx` hoch.
2. Das Backend extrahiert Text.
3. Ein LLM wandelt das Material in ein HTML-Sheet mit Lücken um.
4. Das neue Sheet wird direkt in der Datenbank gespeichert.

## Einfache ER-Sicht

```text
user
  1 -> n school
  1 -> n classroom
  1 -> n learner
  1 -> n sheet
  1 -> n classroom_sheet
  1 -> n agent_chat_log

school
  1 -> n classroom

classroom
  1 -> n learner
  n -> m sheet   (über classroom_sheet)

sheet
  1 -> n answer  (fachlich über sheet.key)

answer
  gehört logisch zu:
  - einem sheet
  - einem Feld im sheet
  - einem Bearbeiter
  - optional einer Klasse
```

## Abgrenzungen und Hinweise

### Fachlich relevant

- `product.php` wirkt wie ein altes Beispielmodell und gehört nicht zum eigentlichen ABU-Fachmodell.
- Die Tabelle `migration` ist rein technisch und nicht fachlich.

### Modellgrenzen

- `answer.user` ist kein echter Fremdschlüssel auf `learner.id`, sondern ein flexibler Identifier.
- `classroom_sheet.sheet_key` referenziert bewusst nicht `sheet.id`, sondern den stabilen fachlichen Schlüssel.
- Das Modell bevorzugt praktische Unterrichtsprozesse gegenüber maximal strikter relationaler Normierung.

## Kurzfazit

Inhaltlich ist ABU eine arbeitsblattzentrierte Unterrichtsplattform für Lehrpersonen und Lernende. Das Datenmodell ist darauf optimiert,

- Unterricht organisatorisch über Schulen, Klassen und Lernende abzubilden,
- Arbeitsblätter versionierbar und stabil zu halten,
- Zuweisungen pro Klasse zu steuern,
- Antworten einfach zu erfassen und auszuwerten,
- KI als produktive Zusatzschicht für Bewertung, Import und Assistenz einzusetzen.

Der wichtigste fachliche Gedanke des Systems ist dabei: Das Arbeitsblatt ist das Zentrum, und alles andere organisiert, verteilt, bearbeitet oder analysiert dieses Arbeitsblatt.
