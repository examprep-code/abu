# Datian TODOs / Notizen

## Backend (datian-core/helper.php)
- Nach `mysqli_connect` Charset setzen: `mysqli_set_charset($db, 'utf8mb4');`
- `json()` robust machen mit `JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE` und Fallback, falls `json_encode` fehlschlägt.

## Frontend Konfiguration
- `.env` in `abu-front` auf Produktions-URLs setzen: 
  - `BACKEND_BASE_URL=https://abu.uhx.ch/abu-back/`
  - `FRONTEND_BASE_URL=https://abu.uhx.ch/abu-front/`
- Mixed-Content vermeiden: kein `http://` wenn Seite per HTTPS läuft.

## Deployment Hinweise
- `PATH` in `abu-back/env.php` bei Subfolder `abu-back/` setzen.
- `.htaccess` in `abu-back/` mit `RewriteBase /abu-back/` nutzen.
- Für bestehende DB nur `service/alter` nutzen, nicht `service/migrate` (würde droppen).
- Für Produktion `DEBUG` in `abu-back/env.php` auf `false` stellen.

## Status
- DB-Verbindung jetzt ok.
- GET /answer liefert Daten; leere Response kam von `json_encode`-Fehlern, durch robustes `json()` behoben.
