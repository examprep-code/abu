SHELL := /usr/bin/env bash

.PHONY: deploy deploy-backend deploy-frontend deploy-test deploy-migrate deploy-alter deploy-env deploy-logs deploy-shell deploy-cmd deploy-key

deploy:
	./scripts/deploy/deploy.sh

deploy-backend:
	./scripts/deploy/deploy.sh --backend-only

deploy-frontend:
	./scripts/deploy/deploy.sh --frontend-only

deploy-test:
	./scripts/deploy/test.sh

deploy-migrate:
	./scripts/deploy/migrate.sh

deploy-alter:
	./scripts/deploy/migrate.sh --alter

deploy-env:
	./scripts/deploy/push-env.sh

deploy-logs:
	./scripts/deploy/logs.sh

deploy-shell:
	./scripts/deploy/remote.sh

deploy-cmd:
	@if [[ -z "$(CMD)" ]]; then echo "Usage: make deploy-cmd CMD='cd /httpdocs && ls -la'"; exit 1; fi
	./scripts/deploy/remote.sh "$(CMD)"

deploy-key:
	./scripts/deploy/setup-key.sh
