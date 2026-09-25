SHELL := /usr/bin/env bash
.SHELLFLAGS := -c

NVM_SH := $(HOME)/.nvm/nvm.sh
PNPM = source $(NVM_SH) >/dev/null && nvm use --silent && pnpm

.PHONY: help db-up db-reset db-seed db-reinit

help:
	@echo "Cibles disponibles :"
	@echo "  make db-up      : démarre le PostgreSQL local (Docker)"
	@echo "  make db-reset   : remet le PostgreSQL local à zéro (supprime le volume)"
	@echo "  make db-seed    : exécute le seed (operators + programs + projects + users)"
	@echo "  make db-reinit  : reset puis seed"

db-up:
	@$(PNPM) db:up

db-reset:
	@$(PNPM) db:reset

db-seed:
	@$(PNPM) seed

db-reinit: db-reset db-seed
