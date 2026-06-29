#!/usr/bin/env bash
# PostToolUse(Write|Edit|MultiEdit): remind to regenerate the Payload import map
# after touching a custom admin component.
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

case "$file" in
  */apps/cms/src/components/*.tsx)
    cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"A custom Payload admin component under apps/cms/src/components was changed. If you added or removed a component registered in Payload config, regenerate the import map with `pnpm generate:importmap`. Never edit importMap.js by hand."}}
JSON
    ;;
esac

exit 0
