# Google Workspace (gworkspace)

Accesso a Gmail, Google Calendar, Google Tasks e Google Drive dell'account
`frederico.mafli@gmail.com` tramite il CLI `gog`.

**Sola lettura, TRANNE due comandi su Google Tasks** (`tasks-add`,
`tasks-done`, dal 24.08.2026). Gmail, Calendar e Drive restano in lettura pura.

**Come invocarla:** `POST /api/apps/gworkspace/run` con body
`{"args": ["<comando>", "<arg>", …]}`, oppure — ed è la strada di casa —
`bash ~/.aos2/pilastri/attivo/gworkspace/entry.sh <comando> …` con
`GOG_KEYRING_PASSWORD` nell'ambiente (da `~/.agentic-os/gog.env`).
L'output è sempre JSON sullo stdout.

## Comandi in lettura
- `gmail [query]` — cerca email. Default `in:inbox`. Es: `{"args":["gmail","is:unread"]}`
- `calendar [calendarId] [flag]` — eventi. **Inchiodato a `events list`**: solo
  flag di lettura da lista bianca, ogni altro flag è rifiutato rumorosamente.
- `calendars` — elenco dei calendari (id, nome, ruolo).
- `tasks-lists` — elenco delle liste (`{"tasklists":[{id,title,…}]}`).
- `tasks [listId]` — task di una lista (`{"tasks":[…]}`), o le liste se ometti l'id.
- `drive [query]` — file nella cartella principale di Drive, oppure ricerca full-text.

## Comandi in scrittura (solo Google Tasks)

- `tasks-add <listId> --title TESTO [--notes TESTO] [--due YYYY-MM-DD]`
  Crea un task. Risponde `{"task": {"id": …, "status": "needsAction", …}}`.
- `tasks-done <listId> <taskId>`
  Marca il task completato. Risponde `{"task": {"status": "completed", …}}`.

Chi li usa oggi: **`vedetta-esterna`** (apre il ticket quando un sito è rotto) e
**`coda-l1`** (il tap "Fatto" chiude il ticket). Prima passavano da
`POST :3000/api/gworkspace/tasks`, una rotta del runtime 1.0: era il residuo #1
di `pilastri/README.md`, sciolto il 24.08.

## Note di sicurezza

- **Il calendario non si scrive. Mai.** Due difese, non una: la lista bianca dei
  flag in `entry.sh`, e `gog --enable-commands=tasks.add|tasks.done` sui due
  comandi di scrittura — anche se qualcuno riuscisse a infilare altro in argv,
  è `gog` stesso a rifiutare (`command "calendar events" is not enabled`).
- `tasks-add` accetta **solo** `--title`, `--notes`, `--due`, e solo nella forma
  `--flag VALORE`. Qualunque altro argomento è un errore parlante, non un
  silenzio. `--title` è obbligatorio.
- `tasks-done` accetta **esattamente due** argomenti. Gli id sono validati con
  un'espressione regolare (`[A-Za-z0-9_:=-]`): niente passa per lo shell.
- Niente invio email, niente creazione/cancellazione di eventi o file Drive,
  niente cancellazione di task (`tasks delete` **non** è esposto: chiudere un
  ticket è reversibile, cancellarlo no).
- Se Google non è configurato, `gog` risponde con un errore "missing --account /
  not authenticated": in tal caso NON ritentare in loop, segnala che serve
  `gog auth manage`.
