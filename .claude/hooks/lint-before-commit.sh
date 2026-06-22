#!/usr/bin/env bash
# PreToolUse(Bash): run `nx affected -t lint` before allowing a git commit.
# Blocks the commit (exit 2) if lint fails, feeding the errors back to Claude.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

# Only intercept real commits (ignore `git log --commit`, messages mentioning commit, etc.)
if ! printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Global node is available; nx is invoked through its JS entrypoint to avoid PATH issues.
log=$(node node_modules/nx/bin/nx.js affected -t lint 2>&1)
status=$?

if [ "$status" -ne 0 ]; then
  echo "Commit blocked: 'nx affected -t lint' failed. Fix the lint errors before committing." >&2
  printf '%s\n' "$log" | tail -n 40 >&2
  exit 2
fi

exit 0
