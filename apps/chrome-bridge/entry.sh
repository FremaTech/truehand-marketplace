#!/usr/bin/env bash
# chrome-bridge AOS-App — wrappa la CLI chrome-bridge per gli agenti nativi.
# Pilota il Chrome REALE dell'utente (estensione esterna), separato dal browser
# headless interno di Agentic OS. Output JSON.
#
# AUTO-DETECT: in WSL2 l'estensione Chrome polla il server bridge che gira su
# Windows (raggiungibile via default-gateway WSL), NON il server locale WSL.
# Se CHROME_BRIDGE_URL non e' impostato esplicitamente, questa app prova
# localhost (WSL) poi il default gateway (Windows) e sceglie quello attivo.
#
#   POST /api/apps/chrome-bridge/run {"args":["status"]}
#   POST /api/apps/chrome-bridge/run {"args":["diagnose"]}
#   POST /api/apps/chrome-bridge/run {"args":["navigate","https://example.com"]}
#   POST /api/apps/chrome-bridge/run {"args":["screenshot"]}
#   POST /api/apps/chrome-bridge/run {"args":["inspect"]}
#   POST /api/apps/chrome-bridge/run {"args":["buttons"]}
#   POST /api/apps/chrome-bridge/run {"args":["tab_open","https://example.com"]}
#   POST /api/apps/chrome-bridge/run {"args":["tab_close","42"]}
#   POST /api/apps/chrome-bridge/run {"args":["tab_activate","42"]}
#   POST /api/apps/chrome-bridge/run {"args":["scroll","down"]}
#   POST /api/apps/chrome-bridge/run {"args":["select","country","Switzerland"]}
#   POST /api/apps/chrome-bridge/run {"args":["click_xy","350","280"]}
#   POST /api/apps/chrome-bridge/run {"args":["agent_tab"]}
set -uo pipefail

CB_HOME="${CHROME_BRIDGE_HOME:-/home/frede/chrome-bridge}"
CLI="$CB_HOME/bin/chrome-bridge.js"
ARTDIR="${AOS_ARTIFACTS_DIR:-/home/frede/agentic-os/public/artifacts}"

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  for n in "$HOME"/.nvm/versions/node/*/bin/node; do [ -x "$n" ] && NODE="$n" && break; done
fi
if [ -z "$NODE" ] || [ ! -f "$CLI" ]; then
  echo '{"ok":false,"error":"chrome-bridge non installato o node assente (CB_HOME='$CB_HOME')"}'; exit 1
fi

# --- AUTO-DETECT endpoint ---------------------------------------------------
# Returns the active bridge URL by probing candidates. Writes nothing to stdout
# except the chosen URL (for capture). Uses short timeout to avoid blocking.
cb_probe() {
  local url="$1"
  curl -s --max-time 2 "$url/status" 2>/dev/null || echo '{"connected":false,"lastPollMsAgo":999999999}'
}

cb_pick_url() {
  # If explicit override is set, honor it.
  if [ -n "${CHROME_BRIDGE_URL:-}" ]; then
    echo "$CHROME_BRIDGE_URL"
    return
  fi

  # Build candidate list: localhost first, then default-gateway WSL (Windows host).
  local candidates=()
  candidates+=("http://localhost:47800")

  # Default gateway = Windows host in WSL2 NAT. ip route shows it.
  local gw
  gw="$(ip route show default 2>/dev/null | awk '/^default/ {print $3; exit}')"
  if [ -n "$gw" ]; then
    candidates+=("http://$gw:47800")
  fi

  # Probe each candidate; pick the one with the smallest lastPollMsAgo
  # (i.e. the one the extension is actually polling).
  local best_url=""
  local best_age=999999999999
  for c in "${candidates[@]}"; do
    local resp age
    resp="$(cb_probe "$c")"
    age="$(echo "$resp" | grep -oE '"lastPollMsAgo":[0-9]+' | head -1 | cut -d: -f2)"
    [ -z "$age" ] && age=999999999999
    if [ "$age" -lt "$best_age" ]; then
      best_age="$age"
      best_url="$c"
    fi
  done

  if [ -z "$best_url" ]; then
    best_url="http://localhost:47800"
  fi
  echo "$best_url"
}

# Pick once at startup; export so child CLI (chrome-bridge.js) uses the same.
if [ -z "${CHROME_BRIDGE_URL:-}" ]; then
  export CHROME_BRIDGE_URL="$(cb_pick_url)"
fi

cmd="${1:-status}"; shift 2>/dev/null || true

# Helper: run CLI with --json and optional --tab
run_cli() {
  local tab_flag=""
  if [ -n "${AOS_CB_TAB_ID:-}" ]; then
    tab_flag="--tab $AOS_CB_TAB_ID"
  fi
  eval "\"$NODE\" \"$CLI\" $* $tab_flag --json"
}

case "$cmd" in
  status)
    "$NODE" "$CLI" status --json
    ;;
  diagnose)
    # Diagnostic: shows both candidate endpoints side by side (for debugging).
    gw="$(ip route show default 2>/dev/null | awk '/^default/ {print $3; exit}')"
    out='{'
    out+='"chosen_url":"'"$CHROME_BRIDGE_URL"'",'
    out+='"default_gateway":"'"${gw:-none}"'",'
    out+='"candidates":['
    # localhost
    r1="$(cb_probe "http://localhost:47800")"
    out+='{"label":"wsl_local","url":"http://localhost:47800","status":'$r1'},'
    # gateway
    if [ -n "$gw" ]; then
      r2="$(cb_probe "http://$gw:47800")"
      out+='{"label":"windows_gateway","url":"http://'"$gw"':47800","status":'$r2'}'
    fi
    # trim trailing comma
    out="${out%,}"
    out+=']}'
    echo "$out"
    ;;
  tabs)     "$NODE" "$CLI" tabs --json ;;
  navigate)
    # NAVIGA E ASPETTA CHE LA PAGINA SIA DAVVERO PRONTA.
    #
    # Prima si estraeva subito dopo il navigate, e su qualunque sito moderno
    # (a maggior ragione dietro Cloudflare) i primi secondi mostrano solo una
    # schermata d'attesa. Il ponte fotografava QUELLA e la consegnava
    # all'agente, che concludeva "non vedo niente" e si arrendeva. Il 22.08.2026
    # e' costato una serata intera: l'agente ha detto "lo stato della pagina era
    # vuoto, non so se ho cliccato Submit" mentre la pagina, dodici secondi
    # dopo, era perfettamente leggibile e l'utente perfino gia' loggato.
    #
    # Ora si ri-estrae finche' il contenuto smette di essere un interstiziale.
    # Il giudizio sta in _pagina_pronta.py: si guarda il TITOLO ("Just a
    # moment", "Ci siamo quasi"...), la presenza di un Ray ID di Cloudflare e
    # il numero di link. Nessuna pausa fissa: si esce appena la pagina e' buona,
    # quindi un sito veloce non ci rimette niente.
    _nav_out="$("$NODE" "$CLI" navigate "${1:-}" --json)"
    _atteso=0
    while [ "$_atteso" -lt 20 ]; do
      if printf '%s' "$_nav_out" | python3 "$(dirname "$0")/_pagina_pronta.py"; then break; fi
      sleep 2
      _atteso=$((_atteso + 2))
      _nav_out="$("$NODE" "$CLI" extract --json 2>/dev/null || printf '%s' "$_nav_out")"
    done
    printf '%s' "$_nav_out"
    ;;
  extract)  "$NODE" "$CLI" extract --json ;;
  click)    "$NODE" "$CLI" click "${1:-}" --json ;;
  type)     "$NODE" "$CLI" type "${1:-}" "${2:-}" --json ;;
  key)      "$NODE" "$CLI" key "${1:-Enter}" --json ;;
  inspect)
    # Inspect: list input fields on the current page
    # Uses CLI raw op dispatch: sends op=inspect to the server
    "$NODE" "$CLI" inspect --json 2>/dev/null || \
    curl -s -X POST "$CHROME_BRIDGE_URL/command" \
      -H 'content-type: application/json' \
      -d '{"op":"inspect"}'
    ;;
  buttons)
    # Buttons: list clickable buttons on the current page
    "$NODE" "$CLI" buttons --json 2>/dev/null || \
    curl -s -X POST "$CHROME_BRIDGE_URL/command" \
      -H 'content-type: application/json' \
      -d '{"op":"buttons"}'
    ;;
  tab_open)
    "$NODE" "$CLI" open "${1:-about:blank}" --json
    ;;
  tab_close)
    # arg = tabId
    curl -s -X POST "$CHROME_BRIDGE_URL/command" \
      -H 'content-type: application/json' \
      -d "{\"op\":\"tab_close\",\"tabId\":${1:-0}}"
    ;;
  tab_activate)
    # arg = tabId — focus a specific tab by ID
    curl -s -X POST "$CHROME_BRIDGE_URL/command" \
      -H 'content-type: application/json' \
      -d "{\"op\":\"tab_activate\",\"tabId\":${1:-0}}"
    ;;
  agent_tab)
    # Create or get the dedicated agent tab (Chrome Bridge group)
    curl -s -X POST "$CHROME_BRIDGE_URL/command" \
      -H 'content-type: application/json' \
      -d '{"op":"agent_tab"}'
    ;;
  click_xy)
    # Click at exact coordinates (x, y) via CDP — for precision clicks
    # args: x y
    x="${1:-0}"
    y="${2:-0}"
    curl -s -X POST "$CHROME_BRIDGE_URL/command" \
      -H 'content-type: application/json' \
      -d "{\"op\":\"click_xy\",\"x\":$x,\"y\":$y}"
    ;;
  scroll)
    # scroll up/down/left/right by pixel amount via injected script
    direction="${1:-down}"
    amount="${2:-800}"
    curl -s -X POST "$CHROME_BRIDGE_URL/command" \
      -H 'content-type: application/json' \
      -d "{\"op\":\"scroll\",\"direction\":\"$direction\",\"amount\":$amount}"
    ;;
  select)
    # select an option in a <select> dropdown
    # args: selector (CSS or name/id), value
    selector="${1:-}"
    value="${2:-}"
    curl -s -X POST "$CHROME_BRIDGE_URL/command" \
      -H 'content-type: application/json' \
      -d "{\"op\":\"select\",\"selector\":\"$selector\",\"value\":\"$value\"}"
    ;;
  wait_for)
    # Wait for text or selector to appear (polls up to timeout seconds)
    target="${1:-}"
    timeout="${2:-15}"
    # We implement this client-side: poll extract until text appears
    elapsed=0
    while [ "$elapsed" -lt "$timeout" ]; do
      result="$("$NODE" "$CLI" extract --json 2>/dev/null)"
      if echo "$result" | grep -qi "$target"; then
        echo '{"ok":true,"found":true,"text":"'"$target"'","waited_s":'"$elapsed"'}'
        exit 0
      fi
      sleep 2
      elapsed=$((elapsed + 2))
    done
    echo '{"ok":false,"error":"timeout: text not found within '"$timeout"'s","target":"'"$target"'"}'
    ;;
  screenshot)
    mkdir -p "$ARTDIR"
    fname="cb-shot-$(date +%s).png"
    out="$ARTDIR/$fname"
    res="$("$NODE" "$CLI" screenshot "$out" --json 2>&1)"
    if echo "$res" | grep -q '"ok": true' 2>/dev/null || [ -f "$out" ]; then
      url="/artifacts/$fname"
      printf '{"ok":true,"path":"%s","image_url":"%s","show_in_chat":"![screenshot](%s)","hint":"Incolla il valore di show_in_chat nella tua risposta per mostrare lo screenshot all\\u0027utente."}\n' "$out" "$url" "$url"
    else
      echo "$res"
    fi
    ;;
  eval)
    # Esegue JavaScript nella pagina via CDP (nessun limite CSP) e ritorna il
    # valore. La valvola di sfogo per tutto cio' che i comandi fissi non coprono.
    "$NODE" "$CLI" eval "$@" --json
    ;;
  map|page_map)
    # La mappa unica della pagina: bottoni, link, campi, checkbox con stato e
    # coordinate, iframe e shadow DOM inclusi. Meglio di inspect+buttons.
    "$NODE" "$CLI" map --json
    ;;
  console)
    "$NODE" "$CLI" console "${1:-50}" --json
    ;;
  network)
    "$NODE" "$CLI" network "${1:-}" "${2:-50}" --json
    ;;
  hover)
    "$NODE" "$CLI" hover "${1:-}" --json
    ;;
  insert)
    # Battitura CDP per editor rich (contenteditable, Draft.js): type normale
    # su questi campi puo' perdere il testo. args: campo, testo [, replace]
    if [ "${3:-}" = "replace" ]; then
      "$NODE" "$CLI" insert "${1:-}" "${2:-}" --replace --json
    else
      "$NODE" "$CLI" insert "${1:-}" "${2:-}" --json
    fi
    ;;
  upload)
    # Mette un file in un input type=file. args: percorso (WSL va bene), [selettore]
    "$NODE" "$CLI" upload "${1:-}" "${2:-}" --json
    ;;
  back)
    "$NODE" "$CLI" back --json
    ;;
  forward)
    "$NODE" "$CLI" forward --json
    ;;
  help|-h|--help)
    cat <<'USAGE'
{"app":"chrome-bridge","usage":{
  "status":"L'estensione Chrome e' connessa?",
  "diagnose":"Mostra entrambi i candidati (WSL e Windows) per diagnosticare quale server e' attivo.",
  "tabs":"Elenca le tab aperte nel Chrome reale.",
  "navigate <url>":"Vai all'URL nella tab agente ed estrai testo+link.",
  "extract":"Ri-estrai la pagina corrente.",
  "click <selettore-o-testo>":"Click reale (CSS o testo visibile).",
  "click_xy <x> <y>":"Click per coordinate pixel (precisione assoluta).",
  "type <campo> <testo>":"Scrivi in un campo.",
  "key <Enter|ArrowDown|Escape|Tab>":"Premi un tasto.",
  "inspect":"Elenca i campi input/textarea della pagina.",
  "buttons":"Elenca i bottoni clickabili della pagina.",
  "tab_open <url>":"Apri una nuova tab.",
  "tab_close <tabId>":"Chiudi una tab per ID.",
  "tab_activate <tabId>":"Attiva (focus) una tab per ID.",
  "agent_tab":"Crea/ottiene la tab agente dedicata (Chrome Bridge group).",
  "scroll <up|down|left|right> [px]":"Scrolla la pagina (default 800px).",
  "select <selettore> <valore>":"Seleziona opzione in un <select>.",
  "wait_for <testo> [timeout]":"Attende che un testo compaia nella pagina.",
  "screenshot":"Cattura la pagina SENZA rubare il focus; ritorna show_in_chat = markdown immagine.",
  "eval <codice js>":"Esegue JavaScript nella pagina e ritorna il valore. Per tutto cio' che gli altri comandi non coprono.",
  "map":"Mappa unica: bottoni+link+campi+checkbox con stato e coordinate, iframe e shadow DOM inclusi.",
  "console [n]":"Ultimi messaggi console della tab (errori JS compresi).",
  "network [filtro] [n]":"Ultime richieste di rete della tab (status, errori).",
  "hover <selettore-o-testo>":"Muove il mouse sopra un elemento (menu a comparsa).",
  "insert <campo> <testo> [replace]":"Battitura reale via CDP per editor rich; con replace svuota prima.",
  "upload <file> [selettore]":"Mette un file in un input type=file (percorso WSL ok).",
  "back / forward":"Cronologia della tab."
}}
USAGE
    ;;
  *) echo '{"ok":false,"error":"comando sconosciuto: '"$cmd"'"}'; exit 1 ;;
esac