#!/usr/bin/env bash
# worktree-db.sh — Manage the per-worktree PostgreSQL databases created by
# .claude/skills/worktree-init/worktree-init.sh
#
# Usage:
#   ./scripts/worktree-db.sh list            list the worktree databases and their size
#   ./scripts/worktree-db.sh drop <branch>   drop the database of one branch
#   ./scripts/worktree-db.sh prune [--yes]   drop the databases with no worktree left
set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

# Databases of the main checkout: never dropped by this script.
PROTECTED=("tee" "tee_test")

# `</dev/null` matters: without it the container command eats the stdin of the
# caller's `while read` loop, which then stops after the first row.
psql_main() {
  docker compose exec -T postgres psql -q -tA -U tee -d tee "$@" </dev/null
}

require_postgres() {
  if ! docker compose exec -T postgres pg_isready -U tee -d tee >/dev/null 2>&1; then
    echo "ERROR: local PostgreSQL is not running. Start it with 'pnpm db:up'." >&2
    exit 1
  fi
}

# Same normalisation as worktree-init.sh, so a branch always maps to one name.
db_name_for_branch() {
  local slug="${1//\//-}"
  echo "tee_$(echo "$slug" | tr '[:upper:]-' '[:lower:]_' | tr -cd 'a-z0-9_')"
}

is_protected() {
  local candidate="$1"
  for name in "${PROTECTED[@]}"; do
    [ "$candidate" = "$name" ] && return 0
  done
  return 1
}

# Database names expected by the worktrees that still exist.
expected_databases() {
  git worktree list --porcelain | awk '/^branch /{print $2}' | sed 's#refs/heads/##' |
    while read -r branch; do db_name_for_branch "$branch"; done
}

worktree_databases() {
  psql_main -c "SELECT datname FROM pg_database WHERE datname LIKE 'tee\\_%' ORDER BY datname"
}

drop_database() {
  local db="$1"
  if is_protected "$db"; then
    echo "ERROR: ${db} belongs to the main checkout, refusing to drop it." >&2
    exit 1
  fi
  # Open connections (a dev server left running) would block the drop.
  psql_main -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid()" >/dev/null
  psql_main -c "DROP DATABASE IF EXISTS ${db}"
  echo "   dropped: ${db}"
}

cmd_list() {
  require_postgres
  local expected
  expected="$(expected_databases)"
  printf '%-34s %10s  %s\n' "DATABASE" "SIZE" "WORKTREE"
  while read -r db; do
    [ -z "$db" ] && continue
    is_protected "$db" && continue
    local size status
    size="$(psql_main -c "SELECT pg_size_pretty(pg_database_size('${db}'))")"
    if echo "$expected" | grep -qx "$db"; then status="present"; else status="gone (prunable)"; fi
    printf '%-34s %10s  %s\n' "$db" "$size" "$status"
  done <<< "$(worktree_databases)"
}

cmd_drop() {
  local branch="${1:?Usage: ./scripts/worktree-db.sh drop <branch>}"
  require_postgres
  local db
  db="$(db_name_for_branch "$branch")"
  echo "==> Dropping ${db} (branch ${branch})..."
  drop_database "$db"
}

cmd_prune() {
  require_postgres
  local expected orphans=()
  expected="$(expected_databases)"
  while read -r db; do
    [ -z "$db" ] && continue
    is_protected "$db" && continue
    echo "$expected" | grep -qx "$db" || orphans+=("$db")
  done <<< "$(worktree_databases)"

  if [ "${#orphans[@]}" -eq 0 ]; then
    echo "Nothing to prune: every worktree database still has its worktree."
    return
  fi

  echo "Databases whose worktree no longer exists:"
  printf '   %s\n' "${orphans[@]}"

  if [ "${1:-}" != "--yes" ]; then
    read -r -p "Drop them? [y/N] " answer
    [ "$answer" = "y" ] || [ "$answer" = "Y" ] || { echo "Aborted."; return; }
  fi

  for db in "${orphans[@]}"; do drop_database "$db"; done
}

case "${1:-}" in
  list) cmd_list ;;
  drop) shift; cmd_drop "$@" ;;
  prune) shift; cmd_prune "$@" ;;
  *)
    echo "Usage: ./scripts/worktree-db.sh {list | drop <branch> | prune [--yes]}" >&2
    exit 1
    ;;
esac
