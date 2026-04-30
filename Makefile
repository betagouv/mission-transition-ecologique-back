DB_FILE := apps/cms/tee-poc.db

SHELL := /usr/bin/env bash
.SHELLFLAGS := -c

NVM_SH := $(HOME)/.nvm/nvm.sh
PNPM = source $(NVM_SH) >/dev/null && nvm use --silent && pnpm

.PHONY: help db-reset db-seed db-reinit

help:
	@echo "Cibles disponibles :"
	@echo "  make db-reset   — supprime la base SQLite locale"
	@echo "  make db-seed    — exécute le seed (operators + programs + projects + users)"
	@echo "  make db-reinit  — reset puis seed"

db-reset:
	@rm -f $(DB_FILE) $(DB_FILE)-journal $(DB_FILE)-wal $(DB_FILE)-shm
	@echo "Base supprimée : $(DB_FILE)"

db-seed:
	@$(PNPM) seed

db-reinit: db-reset db-seed
