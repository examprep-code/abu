# Metanet Deploy Setup (ABU)

Dieses Setup erlaubt Deploy, Smoke-Tests, Migrationen und Remote-Debug direkt per Shell.
Es ist für Metanet/Plesk mit SSH-Port `2121` ausgelegt.

## 1) Initial einrichten

```bash
cp scripts/deploy/config.example.sh scripts/deploy/config.local.sh
cp scripts/deploy/env.example.sh scripts/deploy/env.local.sh
```

Danach `scripts/deploy/config.local.sh` und `scripts/deploy/env.local.sh` mit echten Werten füllen.

## 2) SSH-Key auf Server hinterlegen (einmalig)

```bash
./scripts/deploy/setup-key.sh
```

Wenn nötig mit anderem Key:

```bash
./scripts/deploy/setup-key.sh ~/.ssh/id_ed25519_metanet
```

## 3) env.php auf Server schreiben

```bash
./scripts/deploy/push-env.sh
```

Optional mit explizitem Pfad:

```bash
./scripts/deploy/push-env.sh /path/to/custom-env-file.sh
```

## 4) Deploy starten

```bash
./scripts/deploy/deploy.sh
```

Häufige Varianten:

```bash
./scripts/deploy/deploy.sh --backend-only
./scripts/deploy/deploy.sh --frontend-only
./scripts/deploy/deploy.sh --skip-build
./scripts/deploy/deploy.sh --skip-tests
```

## 5) Smoke-Tests, Migration, Logs, Remote-Shell

```bash
./scripts/deploy/test.sh
./scripts/deploy/migrate.sh
./scripts/deploy/migrate.sh --alter
./scripts/deploy/logs.sh
./scripts/deploy/remote.sh
./scripts/deploy/remote.sh "cd /httpdocs/api && ls -la"
```

## Hinweise zu Metanet

- SSH-Verbindung über Port `2121`
- Shell ist `bin/bash (chrooted)`
- MySQL über `127.0.0.1` statt `localhost` (für Shell/CLI)
- Kein `sudo` nötig
