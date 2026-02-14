# Agent Logging und Datensatz-Export

Dieses Projekt speichert Agent-Requests/Responses als JSONL-Dateien, damit du:

- Chatverlauf und Kontext lokal persistierst
- Datensaetze fuer Fine-Tuning vorbereitest
- RAG-Importdateien aus denselben Logs erstellst

## 1) Speicherort

Standardpfad:

`abu-back/storage/agent-logs/events-YYYY-MM-DD.jsonl`

Jede Zeile ist ein JSON-Objekt (`event = "agent_chat"`), inkl. Prompt, Kontext, normalisiertem Prompt, Modellantwort, Outcome und Dauer.

## 2) Datenschutz / Redaction

Folgende Felder werden standardmaessig redaktiert:

- E-Mail-Adressen
- Telefonnummern
- OpenAI-Keys und Bearer Tokens

Steuerung per Env-Variablen:

- `AGENT_LOG_ENABLED=true|false` (Default: `true`)
- `AGENT_LOG_REDACT=true|false` (Default: `true`)
- `AGENT_LOG_DIR=/absoluter/pfad` (Default: `abu-back/storage/agent-logs`)
- `AGENT_LOG_MAX_STRING=18000`
- `AGENT_LOG_MAX_ITEMS=250`
- `AGENT_LOG_MAX_DEPTH=10`

## 3) Export fuer Training / RAG

Script:

`abu-back/scripts/export_agent_training.php`

Beispiel:

```bash
php abu-back/scripts/export_agent_training.php \
  --since=2026-02-01 \
  --until=2026-02-14
```

Output:

- `agent-openai-YYYYmmdd-HHMMSS.jsonl` (Chat-Format fuer Fine-Tuning)
- `agent-rag-YYYYmmdd-HHMMSS.jsonl` (Prompt/Kontext/Antwort fuer RAG)

Optionen:

- `--input-dir=/pfad/zu/logs`
- `--output-dir=/pfad/fuer/exports`
- `--include-errors=1` (auch fehlgeschlagene Events exportieren)

## 4) Hinweise

- Das Modell in dieser Laufzeit trainiert sich nicht selbst; Export-Dateien sind fuer ein separates Training bzw. RAG gedacht.
- Logs koennen sensible Nutzerdaten enthalten. Falls noetig, vor Weitergabe zusaetzlich anonymisieren.
