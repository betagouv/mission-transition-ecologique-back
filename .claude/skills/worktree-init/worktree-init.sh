#!/usr/bin/env bash
# worktree-init.sh — Create a git worktree with full project initialization
# Usage: ./.claude/skills/worktree-init/worktree-init.sh <branch-name> [--no-seed]
set -euo pipefail

# ─── PATH setup (nvm may not be in PATH in Claude Code sandbox) ──────────────

if ! command -v pnpm &>/dev/null && [ -d "$HOME/.nvm/versions/node" ]; then
  NODE_DIR="$(ls "$HOME/.nvm/versions/node/" | tail -1)"
  export PATH="$HOME/.nvm/versions/node/${NODE_DIR}/bin:$PATH"
fi

# ─── Arguments ────────────────────────────────────────────────────────────────

BRANCH_NAME="${1:?Usage: ./.claude/skills/worktree-init/worktree-init.sh <branch-name> [--no-seed]}"
RUN_SEED=1
if [ "${2:-}" = "--no-seed" ]; then
  RUN_SEED=0
fi

if [ "${#BRANCH_NAME}" -gt 40 ]; then
  echo "ERROR: Branch name exceeds 40 characters (${#BRANCH_NAME}): ${BRANCH_NAME}" >&2
  echo "       Shorten the branch name (prefix included) before calling this script." >&2
  exit 1
fi

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
BRANCH_SLUG="${BRANCH_NAME//\//-}"
WORKTREE_PATH="$(dirname "$PROJECT_ROOT")/${PROJECT_NAME}-${BRANCH_SLUG}"

if [ -d "$WORKTREE_PATH" ]; then
  echo "ERROR: Directory already exists: ${WORKTREE_PATH}" >&2
  exit 1
fi

# ─── 1. Create worktree ──────────────────────────────────────────────────────

echo "==> Creating worktree: ${WORKTREE_PATH} (branch: ${BRANCH_NAME})"

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}" 2>/dev/null; then
  git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
else
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH"
fi

# ─── 2. Copy gitignored essential files ───────────────────────────────────────
# DB files (tee-*.db) are intentionally NOT copied: each worktree gets a fresh
# local SQLite database, seeded at step 5.

echo "==> Copying gitignored essential files..."

copy_if_exists() {
  local src="${PROJECT_ROOT}/$1"
  local dst="${WORKTREE_PATH}/$1"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "   copied: $1"
  fi
}

copy_if_exists ".env"
copy_if_exists "apps/cms/.env"

# ─── 3. Install dependencies ─────────────────────────────────────────────────

echo "==> Installing Node dependencies (pnpm install)..."
cd "$WORKTREE_PATH"
pnpm install

# ─── 4. Generate Payload artifacts (gitignored, absent from the worktree) ─────
# payload-types.ts + importMap.js are generated files, excluded by .gitignore,
# so they must be regenerated in every fresh worktree.

echo "==> Generating Payload types + import map (pnpm generate)..."
pnpm generate

# ─── 5. Seed the local SQLite database ────────────────────────────────────────

# Seed is non-fatal: the worktree stays usable even if seed data is broken on
# the branch, so warn and continue to port assignment instead of aborting.
SEED_OK=1
if [ "$RUN_SEED" -eq 1 ]; then
  echo "==> Seeding local database (pnpm seed)..."
  if ! pnpm seed; then
    SEED_OK=0
    echo "WARNING: seed failed — worktree is otherwise ready. Inspect 'pnpm seed' on this branch." >&2
  fi
else
  echo "==> Skipping seed (--no-seed); run 'pnpm seed' before first login."
fi

# ─── 6. Assign a free dev port ────────────────────────────────────────────────
# Next.js does not read PORT from .env for `next dev`, so the port is recorded
# in apps/cms/.env.local (for reservation/visibility) and surfaced in the final
# ready-to-run command via `--port`.

echo "==> Assigning a free dev port..."
CMS_ENV_LOCAL="${WORKTREE_PATH}/apps/cms/.env.local"
PARENT_DIR="$(dirname "$PROJECT_ROOT")"

port_in_use() {
  local candidate="$1"
  if ss -ltn 2>/dev/null | grep -q ":${candidate} "; then
    return 0
  fi
  if grep -rhsoE "^PORT=${candidate}$" \
      "${PARENT_DIR}/${PROJECT_NAME}/apps/cms/.env.local" \
      "${PARENT_DIR}/${PROJECT_NAME}-"*/apps/cms/.env.local 2>/dev/null \
    | grep -q .; then
    return 0
  fi
  return 1
}

DEV_PORT=3001
while port_in_use "$DEV_PORT"; do
  DEV_PORT=$((DEV_PORT + 1))
done

mkdir -p "$(dirname "$CMS_ENV_LOCAL")"
cat > "$CMS_ENV_LOCAL" <<EOF
# Auto-genere par worktree-init — port propre a ce worktree.
# Next.js ne lit PAS PORT depuis .env pour 'next dev' : cette valeur sert de
# reservation (detectee par les autres worktrees) et de rappel. Lancer le dev
# avec '--port ${DEV_PORT}' (voir la commande finale).
PORT=${DEV_PORT}
EOF

echo "   dev port: ${DEV_PORT} (apps/cms/.env.local)"

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "============================================"
echo " Worktree ready!"
echo " Path:     ${WORKTREE_PATH}"
echo " Branch:   ${BRANCH_NAME}"
echo " Dev port: ${DEV_PORT}  ->  http://localhost:${DEV_PORT}"
echo "============================================"
if [ "$SEED_OK" -eq 0 ]; then
  echo " WARNING: seed FAILED — run/inspect 'pnpm seed' before first login."
fi
echo ""
echo " cd ../${PROJECT_NAME}-${BRANCH_SLUG}"
echo " pnpm nx run @tee-backoffice/cms:dev -- --turbopack --port ${DEV_PORT}"
