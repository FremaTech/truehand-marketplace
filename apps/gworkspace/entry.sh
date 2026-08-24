#!/usr/bin/env bash
# gworkspace AOS-App — CLI wrapper around `gog` for Gmail / Calendar / Tasks / Drive.
# Sola lettura, TRANNE `tasks-add` e `tasks-done` (Google Tasks, dal 24.08:
# vedi il blocco SCRITTURA piu' sotto). Gmail, Calendar e Drive restano in
# lettura pura. Output sempre JSON. Invocata dagli agenti via:
#   POST /api/apps/gworkspace/run  {"args":["<command>","<arg>"]}
set -uo pipefail

GOG="${GOG_PATH:-/home/frede/.local/bin/gog}"
ACC="${GOG_ACCOUNT:-frederico.mafli@gmail.com}"

cmd="${1:-help}"
shift 2>/dev/null || true

case "$cmd" in
  gmail)
    q="${1:-in:inbox}"
    "$GOG" -a "$ACC" gmail search "$q" --max 100 -j
    ;;
  calendar)
    # SOLA LETTURA, e irrigidita il 24.08 per il pilastro `agenda`.
    # Il sottocomando e' inchiodato a `events list`: da qui non si puo'
    # creare, spostare o cancellare un evento nemmeno per sbaglio.
    # Degli argomenti passa solo una LISTA BIANCA di flag di lettura; ogni
    # altro flag viene rifiutato RUMOROSAMENTE (meglio un guasto che una
    # scrittura di nascosto). Gli argomenti posizionali sono calendarId.
    args=()
    while [ $# -gt 0 ]; do
      case "$1" in
        --days|--max|--from|--to|--cal|--calendars|--query|--page|--week-start)
          if [ $# -lt 2 ]; then
            echo "{\"error\":\"flag $1 senza valore\"}"; exit 1
          fi
          args+=("$1" "$2"); shift 2 ;;
        --days=*|--max=*|--from=*|--to=*|--cal=*|--calendars=*|--query=*|--page=*|--week-start=*)
          args+=("$1"); shift ;;
        --today|--tomorrow|--week|--all-pages)
          args+=("$1"); shift ;;
        -*)
          echo "{\"error\":\"flag non ammesso in sola lettura: $1\",\"ammessi\":[\"--days\",\"--max\",\"--from\",\"--to\",\"--cal\",\"--calendars\",\"--query\",\"--page\",\"--week-start\",\"--today\",\"--tomorrow\",\"--week\",\"--all-pages\"]}"
          exit 1 ;;
        *)
          args+=("$1"); shift ;;
      esac
    done
    "$GOG" -a "$ACC" calendar events list ${args[@]+"${args[@]}"} --results-only -j
    ;;
  calendars|calendar-list)
    "$GOG" -a "$ACC" calendar calendars -j
    ;;
  tasks-lists)
    "$GOG" -a "$ACC" tasks lists -j
    ;;
  tasks)
    if [ "${1:-}" != "" ]; then
      "$GOG" -a "$ACC" tasks list "$1" -j
    else
      "$GOG" -a "$ACC" tasks lists -j
    fi
    ;;
  # ── SCRITTURA (24.08) — l'UNICO varco, e solo su Google Tasks ──────────────
  # Nasce per sciogliere un residuo dichiarato (pilastri/README.md §1):
  # `coda-l1` (azione `done` sui ticket della Vedetta) e `vedetta-esterna`
  # (apertura ticket) passavano da POST :3000/api/gworkspace/tasks, una rotta
  # del runtime 1.0. Con questi due comandi non serve piu' :3000.
  #
  # IL CALENDARIO RESTA BLINDATO. Qui sotto non c'e', e non deve mai nascere,
  # un ramo che scriva su Calendar. Due difese, non una:
  #   1. la lista bianca dei flag (ogni altro argomento = rifiuto rumoroso);
  #   2. `gog --enable-commands=tasks.add|tasks.done`: anche se qualcuno
  #      riuscisse a infilare altro in argv, e' gog stesso a rifiutare
  #      ("command ... is not enabled"). Provato il 24.08 su `calendar events`.
  # Serve GOG_KEYRING_PASSWORD nell'ambiente (da ~/.agentic-os/gog.env), come
  # per ogni altro comando di questa app.
  tasks-add)
    tl="${1:-}"; shift 2>/dev/null || true
    if ! printf '%s' "$tl" | grep -qE '^[A-Za-z0-9_:=-]{1,200}$'; then
      echo "{\"error\":\"tasks-add: tasklistId mancante o non valido\",\"uso\":\"tasks-add <tasklistId> --title TESTO [--notes TESTO] [--due YYYY-MM-DD]\",\"hint\":\"gli id delle liste li da' tasks-lists\"}"
      exit 1
    fi
    args=(); titolo=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --title|--notes|--due)
          if [ $# -lt 2 ]; then echo "{\"error\":\"flag $1 senza valore\"}"; exit 1; fi
          [ "$1" = "--title" ] && titolo="$2"
          args+=("$1" "$2"); shift 2 ;;
        *)
          echo "{\"error\":\"tasks-add: argomento non ammesso: $1\",\"ammessi\":[\"--title\",\"--notes\",\"--due\"],\"nota\":\"lista bianca stretta, e solo nella forma --flag VALORE: qui si scrive SOLO su Google Tasks\"}"
          exit 1 ;;
      esac
    done
    if [ -z "$titolo" ]; then
      echo "{\"error\":\"tasks-add: --title obbligatorio\",\"nota\":\"un task senza titolo non si ritrova piu'\"}"
      exit 1
    fi
    "$GOG" --enable-commands=tasks.add -a "$ACC" tasks add "$tl" ${args[@]+"${args[@]}"} -j
    ;;
  tasks-done)
    tl="${1:-}"; tid="${2:-}"
    if ! printf '%s' "$tl" | grep -qE '^[A-Za-z0-9_:=-]{1,200}$'; then
      echo "{\"error\":\"tasks-done: tasklistId mancante o non valido\",\"uso\":\"tasks-done <tasklistId> <taskId>\"}"; exit 1
    fi
    if ! printf '%s' "$tid" | grep -qE '^[A-Za-z0-9_:=-]{1,200}$'; then
      echo "{\"error\":\"tasks-done: taskId mancante o non valido\",\"uso\":\"tasks-done <tasklistId> <taskId>\"}"; exit 1
    fi
    if [ $# -gt 2 ]; then
      echo "{\"error\":\"tasks-done: argomenti in piu' non ammessi\",\"uso\":\"tasks-done <tasklistId> <taskId>\"}"; exit 1
    fi
    "$GOG" --enable-commands=tasks.done -a "$ACC" tasks done "$tl" "$tid" -j
    ;;
  drive)
    if [ "${1:-}" != "" ]; then
      "$GOG" -a "$ACC" drive search "$1" -j
    else
      "$GOG" -a "$ACC" drive ls -j
    fi
    ;;
  help|-h|--help)
    cat <<'USAGE'
{"app":"gworkspace","usage":{
  "gmail [query]":"Cerca email (default in:inbox)",
  "calendar [calendarId] [flag]":"Eventi del calendario. Flag ammessi (sola lettura): --days N, --max N, --from, --to, --cal, --calendars, --query, --page, --week-start, --today, --tomorrow, --week, --all-pages. Ogni altro flag viene rifiutato.",
  "calendars":"Elenco dei calendari (id, nome, ruolo)",
  "tasks-lists":"Elenco delle liste di Google Tasks",
  "tasks [listId]":"Task di una lista (o tutte le liste se omesso)",
  "tasks-add <listId> --title T [--notes N] [--due YYYY-MM-DD]":"SCRIVE: crea un task. Solo questi tre flag, solo nella forma --flag VALORE.",
  "tasks-done <listId> <taskId>":"SCRIVE: marca un task come completato.",
  "drive [query]":"File in Drive (root) o ricerca full-text"
},"note":"Sola lettura TRANNE tasks-add e tasks-done (Google Tasks, dal 24.08). Output JSON. Non esiste qui un comando che scriva su Gmail, Calendar o Drive: il calendario e' inchiodato a 'events list' e nemmeno gog accetterebbe altro (--enable-commands)."}
USAGE
    ;;
  *)
    echo "{\"error\":\"unknown command: $cmd\",\"hint\":\"usa: gmail|calendar|calendars|tasks|tasks-lists|tasks-add|tasks-done|drive\"}"
    exit 1
    ;;
esac
