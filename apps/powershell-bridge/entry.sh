#!/usr/bin/env bash
# PowerShell Bridge — AOS-App entry point
# Invokes PowerShell on the Windows host from WSL2
set -uo pipefail

CMD="${1:-info}"
shift 2>/dev/null || true

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${AOS_APP_DATA:-$APP_DIR/data}"
STATE_FILE="${AOS_APP_STATE:-$APP_DIR/state.json}"
LOG_FILE="${AOS_APP_LOG:-/tmp/powershell-bridge.log}"
ALLOWLIST_FILE="$DATA_DIR/allowlist.json"

mkdir -p "$DATA_DIR"

# --- Detect PowerShell ---
detect_ps() {
  if command -v /mnt/c/Program\ Files/PowerShell/7/pwsh.exe &>/dev/null; then
    echo "/mnt/c/Program Files/PowerShell/7/pwsh.exe"
  elif command -v /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe &>/dev/null; then
    echo "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
  else
    echo ""
  fi
}

PS_BIN=""
PS_BIN=$(detect_ps)
if [[ -z "$PS_BIN" ]]; then
  echo '{"ok":false,"error":"No PowerShell found on Windows host"}'
  exit 1
fi

PS_TAG="ps5"
[[ "$PS_BIN" == *"pwsh.exe"* ]] && PS_TAG="pwsh7"

# --- Safety: blocked commands ---
BLOCKED_PATTERNS=(
  "Remove-Item"
  "Stop-Process"
  "Remove-Service"
  "Uninstall-"
  "Stop-Computer"
  "Restart-Computer"
  "Format-Volume"
  "netsh"
  "reg delete"
  "sc delete"
  "Remove-WmiObject"
  "Clear-EventLog"
)

check_blocked() {
  local cmd="$1"
  local allowlist="[]"
  [[ -f "$ALLOWLIST_FILE" ]] && allowlist=$(cat "$ALLOWLIST_FILE" 2>/dev/null || echo "[]")
  for pattern in "${BLOCKED_PATTERNS[@]}"; do
    if echo "$cmd" | grep -qi "$pattern"; then
      if echo "$allowlist" | grep -qi "$pattern" 2>/dev/null; then
        return 1  # allowed via allowlist
      fi
      return 0  # blocked
    fi
  done
  return 1  # not blocked
}

# --- Run a PS command ---
run_ps() {
  local ps_cmd="$1"
  local timeout_sec="${2:-30}"

  local stdout
  stdout=$(
    timeout "${timeout_sec}s" "$PS_BIN" -NoProfile -Command "$ps_cmd" 2>/dev/null
  ) || true

  # Truncate if > 512KB
  local max_bytes=524288
  if (( ${#stdout} > max_bytes )); then
    stdout="${stdout:0:$max_bytes}... [TRUNCATED: ${#stdout} bytes total]"
  fi

  echo "$stdout"
}

# --- Commands ---
cmd_info() {
  local win_user win_host ps_ver
  win_user=$("$PS_BIN" -NoProfile -Command 'Write-Output $env:USERNAME' 2>/dev/null || echo "unknown")
  win_host=$("$PS_BIN" -NoProfile -Command 'Write-Output $env:COMPUTERNAME' 2>/dev/null || echo "unknown")
  ps_ver=$("$PS_BIN" -NoProfile -Command '$PSVersionTable.PSVersion.ToString()' 2>/dev/null || echo "unknown")

  cat <<EOF
{"ok":true,"bridge":"powershell-bridge","psTag":"$PS_TAG","psVersion":"$(echo "$ps_ver" | tr -d '[:space:]')","psBin":"$PS_BIN","windowsUser":"$(echo "$win_user" | tr -d '[:space:]')","windowsHostname":"$(echo "$win_host" | tr -d '[:space:]')","wslHostname":"$(hostname)","dataDir":"$DATA_DIR"}
EOF
}

cmd_exec() {
  local ps_cmd="${1:-}"
  if [[ -z "$ps_cmd" ]]; then
    echo '{"ok":false,"error":"No command provided. Usage: exec <powershell-command>"}'
    return 1
  fi

  # Safety check
  if check_blocked "$ps_cmd"; then
    echo "{\"ok\":false,\"error\":\"Command blocked by safety filter. Pattern matched. Add to allowlist.json in $DATA_DIR to override.\",\"command\":\"$ps_cmd\"}"
    return 1
  fi

  local output
  output=$(run_ps "$ps_cmd" 30)

  # Escape for JSON
  local escaped
  escaped=$(echo "$output" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo "\"(encoding error)\"")

  echo "{\"ok\":true,\"output\":$escaped,\"psTag\":\"$PS_TAG\",\"command\":\"$ps_cmd\"}"
}

cmd_script() {
  local script_path="${1:-}"
  if [[ -z "$script_path" ]]; then
    echo '{"ok":false,"error":"No script path provided. Usage: script <path-to-ps1>"}'
    return 1
  fi

  # Convert WSL path to Windows path for the PS script
  local win_path
  win_path=$(wslpath -w "$script_path" 2>/dev/null || echo "$script_path")

  if check_blocked "$script_path"; then
    echo "{\"ok\":false,\"error\":\"Script contains blocked patterns. Add to allowlist.json to override.\",\"path\":\"$script_path\"}"
    return 1
  fi

  local output
  output=$(run_ps "& '$win_path'" 60)

  local escaped
  escaped=$(echo "$output" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo "\"(encoding error)\"")

  echo "{\"ok\":true,\"output\":$escaped,\"psTag\":\"$PS_TAG\",\"script\":\"$script_path\",\"winPath\":\"$win_path\"}"
}

cmd_modules() {
  local output
  output=$(run_ps "Get-Module -ListAvailable | Select-Object -First 50 Name,Version | ConvertTo-Json" 15)

  echo "{\"ok\":true,\"modules\":$output,\"psTag\":\"$PS_TAG\"}"
}

cmd_wslpath() {
  local wsl_path="${1:-}"
  if [[ -z "$wsl_path" ]]; then
    echo '{"ok":false,"error":"No path provided. Usage: wslpath <wsl-or-win-path>"}'
    return 1
  fi

  local to_win to_wsl
  to_win=$(wslpath -w "$wsl_path" 2>/dev/null || echo "")
  to_wsl=$(wslpath -u "$wsl_path" 2>/dev/null || echo "")

  echo "{\"ok\":true,\"input\":\"$wsl_path\",\"windowsPath\":\"$to_win\",\"wslPath\":\"$to_wsl\"}"
}

cmd_winenv() {
  local var_name="${1:-}"
  if [[ -z "$var_name" ]]; then
    echo '{"ok":false,"error":"No variable name. Usage: winenv <VARNAME>"}'
    return 1
  fi
  local value
  value=$("$PS_BIN" -NoProfile -Command "Write-Output \$env:$var_name" 2>/dev/null || echo "")
  echo "{\"ok\":true,\"variable\":\"$var_name\",\"value\":\"$(echo "$value" | tr -d '[:space:]')\"}"
}

# --- Main dispatch ---
# Each cmd_* handler encodes its own success/failure as JSON ("ok":true|false)
# in stdout. A non-zero process exit here is reserved for the "no PowerShell
# found" bridge failure above — a normal "ok":false (safety block, missing
# arg, unknown subcommand) is a well-formed response, not a process error,
# and must not be surfaced as an "exit" error in the app logs.
case "$CMD" in
  info)     cmd_info     ;;
  exec)     cmd_exec "$@" ;;
  script)   cmd_script "$@" ;;
  modules|list-modules)  cmd_modules  ;;
  wslpath)  cmd_wslpath "$@" ;;
  winenv)   cmd_winenv "$@" ;;
  *)
    echo "{\"ok\":false,\"error\":\"Unknown command: $CMD. Available: info, exec, script, modules, wslpath, winenv\"}"
    ;;
esac
exit 0