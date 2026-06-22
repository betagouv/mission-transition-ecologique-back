#!/usr/bin/env bash
# PreToolUse(Bash): run `nx affected -t lint` before allowing a git commit.
# Blocks the commit (exit 2) if lint fails, feeding the errors back to Claude.
set -uo pipefail

input=$(cat)

# Fail closed: if jq is missing or the tool input can't be parsed, block rather
# than silently skipping the lint guard.
if ! command -v jq >/dev/null 2>&1; then
  echo "Commit guard failed: 'jq' is not available to parse the tool input." >&2
  exit 2
fi

if ! cmd=$(printf '%s' "$input" | jq -er '.tool_input.command // ""'); then
  echo "Commit guard failed: could not parse the tool input as JSON." >&2
  exit 2
fi

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
