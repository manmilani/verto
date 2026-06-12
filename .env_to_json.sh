#!/usr/bin/env bash
# sessionStart hook: read .env and emit {"env":{...}} for Cursor.
# No hardcoded keys; no Node or other runtime required.

set -euo pipefail

ENV_FILE="$(dirname "${BASH_SOURCE[0]}")/.env"

json_escape() {
  local s=$1
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

strip_quotes() {
  local val=$1
  if [[ ${#val} -ge 2 ]]; then
    if [[ $val == \"*\" && $val == *\" ]]; then
      val="${val:1:${#val}-2}"
    elif [[ $val == \'*\' && $val == *\' ]]; then
      val="${val:1:${#val}-2}"
    fi
  fi
  printf '%s' "$val"
}

printf '{"env":{'
first=true

if [[ -f $ENV_FILE ]]; then
  while IFS= read -r line || [[ -n $line ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    [[ -z $line || $line == \#* ]] && continue

    if [[ $line == export[[:space:]]* ]]; then
      line="${line#export}"
      line="${line#"${line%%[![:space:]]*}"}"
    fi

    [[ $line != *=* ]] && continue

    key="${line%%=*}"
    val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    val="$(strip_quotes "$val")"

    [[ -z $key ]] && continue

    if $first; then
      first=false
    else
      printf ','
    fi
    printf '"%s":"%s"' "$(json_escape "$key")" "$(json_escape "$val")"
  done < "$ENV_FILE"
fi

printf '}}\n'
