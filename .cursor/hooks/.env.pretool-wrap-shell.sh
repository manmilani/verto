#!/usr/bin/env bash
# preToolUse hook (Shell): load .env, then run the original command.

set -euo pipefail

json_escape() {
  local s=$1
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

unescape_json_string() {
  local s=$1
  s="${s//\\\"/\"}"
  s="${s//\\\\/\\}"
  s="${s//\\n/$'\n'}"
  s="${s//\\r/$'\r'}"
  s="${s//\\t/$'\t'}"
  printf '%s' "$s"
}

allow_only() {
  printf '{"permission":"allow"}\n'
}

allow_wrapped() {
  local wrapped=$1
  local wd=${2:-}
  if [[ -n $wd ]]; then
    printf '{"permission":"allow","updated_input":{"command":"%s","working_directory":"%s"}}\n' \
      "$(json_escape "$wrapped")" "$(json_escape "$wd")"
  else
    printf '{"permission":"allow","updated_input":{"command":"%s"}}\n' \
      "$(json_escape "$wrapped")"
  fi
}

extract_json_string() {
  local raw=$1 field=$2
  local pattern="\"${field}\"[[:space:]]*:[[:space:]]*\"(([^\"\\\\]|\\\\.)*)\""
  if [[ $raw =~ $pattern ]]; then
    unescape_json_string "${BASH_REMATCH[1]}"
  fi
  return 0
}

raw=$(cat)
raw="${raw#$'\xef\xbb\xbf'}"
raw="${raw#"${raw%%[![:space:]]*}"}"
raw="${raw%"${raw##*[![:space:]]}"}"

if [[ -z $raw ]]; then
  allow_only
  exit 0
fi

command=$(extract_json_string "$raw" "command")
working_directory=$(extract_json_string "$raw" "working_directory")

if [[ -z $command ]]; then
  allow_only
  exit 0
fi

if [[ $command == *CURSOR_ENV_LOADED* ]]; then
  allow_wrapped "$command" "$working_directory"
  exit 0
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Cursor agent shell on Windows is PowerShell — including when this hook runs under WSL bash.
use_powershell_wrap=false
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) use_powershell_wrap=true ;;
  Linux)
    if [[ -n ${WSL_DISTRO_NAME:-} ]] || [[ $root == /mnt/* ]]; then
      use_powershell_wrap=true
    fi
    ;;
esac

if $use_powershell_wrap; then
  root_ps="$root"
  if command -v wslpath >/dev/null 2>&1; then
    root_ps="$(wslpath -w "$root")"
  fi
  loader="\$env:CURSOR_ENV_LOADED='1'; Set-Location '$root_ps'; if (Test-Path '.env') { Get-Content '.env' | ForEach-Object { \$t = \$_.Trim(); if (\$t -and -not \$t.StartsWith('#') -and \$t -match '^([^=]+)=(.*)$') { \$k = \$matches[1].Trim(); \$v = \$matches[2].Trim().Trim('\"').Trim(\"'\"); Set-Item -Path env:\$k -Value \$v } } }"
  wrapped="${loader}; ${command}"
else
  wrapped="bash -lc 'set -a; source \"${root}/.env.sh\"; set +a; ${command//\'/\'\\\'\'}'"
fi

allow_wrapped "$wrapped" "$working_directory"
