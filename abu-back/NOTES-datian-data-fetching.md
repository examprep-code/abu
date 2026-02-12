# Notizen: Daten holen mit Datian (Arrays + Modelle)

Kurzfassung: Abfragen laufen nicht ueber SQL-Joins, sondern ueber ein PHP-Array, das die Felder, Beziehungen und Snippets beschreibt. `get()` baut daraus SELECTs, und ruft bei `fkey`/`rkey` rekursiv weitere `get()`-Aufrufe auf.

## 1) Einstieg: Wo liegt die Logik?
- Routing-Helper: `abu-back/datian-core/helper.php`
  - `serve($array, $methods)` entscheidet zwischen `get()` (GET) und `set()` (POST/PATCH/PUT/DELETE).
- CRUD: `abu-back/datian-core/crud.php`
  - `get($output)` baut SELECT + rekursive Subqueries.
  - `set($table, $array, $data, $mode)` schreibt Daten (hier nur am Rand relevant).
- Modelle: `abu-back/model/*.php`
  - Definieren Felder und Beziehungen mit Datentypen wie `fkey` und `rkey`.

## 2) Grundprinzip der Abfrage
Die Query ist ein Array. Pro Tabelle ein Key, darunter die Felder als Keys mit Arrays als Werte.
Nur Felder, die in diesem Array stehen, werden in den SELECT aufgenommen.

Beispiel (nur direkte Felder der Schule):
```
$cfg = [
  'school' => [
    'id' => [],
    'name' => [],
    'ci_css' => [],
  ],
];
$result = get($cfg);
```

Wichtig:
- `select2string()` baut `SELECT id, ...` und nimmt nur Keys, die Arrays sind und **keine** `rkey` sind.
- Wenn ein Feld fehlt, wird es nicht gelesen.

## 3) Beziehungen ueber Modell: fkey / rkey
Definiert in `model/*.php`:
```
'user' => ['fkey', 'table' => 'user', 'key' => 'id']
'classes' => ['rkey', 'table' => 'classroom', 'key' => 'school']
```

### fkey (n:1)
- Feld enthaelt die ID der Fremdtabelle.
- `get()` macht **keinen** SQL-Join, sondern ggf. Subquery.

Verhalten:
- Leeres Array => **kein** Subquery, Rueckgabe nur `['id' => <fk-id>]`.
- Gefuelltes Array => Subquery der Fremdtabelle, Rueckgabe als verschachteltes Objekt.

Beispiele:
```
// Nur die ID der verknuepften user
'user' => []

// User-Daten als Objekt laden
'user' => ['name' => [], 'email' => []]
```

### rkey (1:n)
- Rueckwaerts-Link (Kindertabelle).
- `get()` macht Subquery `child.<key> = parent.id`.

Beispiel:
```
'classes' => ['all']
```
Rueckgabe: `classes` ist ein Array aller Classrooms dieser School.

## 4) Filter und SQL-Anhaenge
### WHERE
- `_where` ist ein Array von SQL-Teilstuecken.
- Wird mit `AND` zusammengebaut.
- **Input immer selber escapen** (z.B. `sql_escape()`), da `_where` raw SQL ist.

Beispiel:
```
'_where' => [
  'user = ' . intval($user['id']),
  'name != ""',
]
```

### APPEND (ORDER BY, LIMIT, GROUP BY ...)
- `_append` wird ans SQL angehaengt.
- Beispiel:
```
'_append' => ['ORDER BY created_at DESC', 'LIMIT 20']
```

## 5) "all"-Flag
- `['all']` in der Tabelle fuegt automatisch alle Felder hinzu (ausser id, rkey, password, token).
- Intern via `flag('all', $array)` + `all($table, $array)`.

Beispiel:
```
'school' => ['all', 'classes' => ['all']]
```

## 6) Snippets (Programmcode in die Abfrage)
Snippets werden in `snippets/` abgelegt und ueber Arrays aktiviert.

Arten:
1) Feld-Snippets: pro Feld in der Query
```
'price' => ['transform/add' => 100]
```
2) Tabellen-Snippets: `_snippets` auf Tabellenebene
```
'_snippets' => ['calc/whatever' => ['arg1' => 1]]
```
3) Typ-Snippets: in `settings/database.php` ueber `$in` und `$out`.

Wichtig:
- Snippets laufen **beim Lesen und Schreiben** (je nach Typ) in `get()`/`set()`.
- Snippet-Variablen: `$value`, `$data`, `$args`.

## 7) Was `serve()` bei GET macht
- Ohne URL-Parameter: `serve($array)` ruft `get($array)` und gibt das Ergebnis als `return['data']` zurueck.
- Mit Parameter (id): `serve()` setzt `_where => ['id = <param>']` auf die erste Tabelle und liefert nur den ersten Treffer.

## 8) Praxis-Muster
- Nur IDs von fkey: Feld als `[]` lassen.
- Details von fkey: Feld mit Unterfeldern fuellen.
- Child-Listen via rkey: rkey-Feld mit `['all']` oder Feldliste.
- Filter immer ueber `_where` (mit `sql_escape`), Sortierung ueber `_append`.

## 9) Wichtige Dateien zum Nachschlagen
- `abu-back/datian-core/crud.php` (get/set Logik)
- `abu-back/datian-core/helper.php` (serve, where, select)
- `abu-back/model/*.php` (fkey/rkey Definition)
- `abu-back/settings/database.php` (typen + $in/$out)
- `abu-back/README.md` (Beispiele zu Arrays und Snippets)
