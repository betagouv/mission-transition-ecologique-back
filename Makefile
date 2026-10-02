SHELL := /usr/bin/env bash
.SHELLFLAGS := -c

NVM_SH := $(HOME)/.nvm/nvm.sh
PNPM = source $(NVM_SH) >/dev/null && nvm use --silent && pnpm

.PHONY: help db-up db-reset db-seed db-reinit wt-db-list wt-db-drop wt-db-prune

help:
	@echo "Cibles disponibles :"
	@echo "  make db-up      : démarre le PostgreSQL local (Docker)"
	@echo "  make db-reset   : remet le PostgreSQL local à zéro (supprime le volume)"
	@echo "  make db-seed    : exécute le seed (operators + programs + projects + users)"
	@echo "  make db-reinit  : reset puis seed"
	@echo ""
	@echo "  Bases des worktrees (une par branche, créées par le skill worktree-init) :"
	@echo "  make wt-db-list             : liste ces bases, leur taille et leur worktree"
	@echo "  make wt-db-drop BRANCH=<b>  : supprime la base d'une branche"
	@echo "  make wt-db-prune            : supprime les bases dont le worktree a disparu"

db-up:
	@$(PNPM) db:up

db-reset:
	@$(PNPM) db:reset

db-seed:
	@$(PNPM) seed

db-reinit: db-reset db-seed

wt-db-list:
	@./scripts/worktree-db.sh list

wt-db-drop:
	@test -n "$(BRANCH)" || { echo "Usage: make wt-db-drop BRANCH=feat/ma-branche"; exit 1; }
	@./scripts/worktree-db.sh drop "$(BRANCH)"

wt-db-prune:
	@./scripts/worktree-db.sh prune
