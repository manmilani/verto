# Load .env with the same parser as the Cursor hooks (.cursor/hooks/env.js), so every shell reads it by one set of rules:
# values are taken literally (no bash expansion or escapes). Also sets CURSOR_ENV_LOADED=1. Needs node on PATH.
if command -v node >/dev/null 2>&1; then
  eval "$(node "$(dirname "${BASH_SOURCE[0]}")/.cursor/hooks/env.js" sh)"
else
  echo ".env.sh: node not found on PATH; .env not loaded" >&2
fi
