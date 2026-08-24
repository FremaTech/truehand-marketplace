# Google Workspace — Guida

App ibrida: 4 interfacce desktop (Gmail, Calendar, Tasks, Drive) + una CLI condivisa,
tutte costruite sul CLI `gog` (Google Workspace) e sul core `lib/gworkspace`.

## UI
Apri Gmail/Calendar/Tasks/Drive dal dock o dalla finestra Apps (sezione "Google Workspace").
Ogni servizio è una finestra indipendente: puoi affiancarle o metterle a schermo intero.
In Tasks puoi scegliere quali liste sincronizzare con il sistema task di AOS.

## CLI per gli agenti
Gli agenti invocano `POST /api/apps/gworkspace/run` con `{"args":[...]}`.
Comandi in lettura: `gmail [query]`, `calendar [calId] [flag]`, `calendars`,
`tasks-lists`, `tasks [listId]`, `drive [query]`.

Comandi in **scrittura** (solo Google Tasks, dal 24.08):
`tasks-add <listId> --title T [--notes N] [--due YYYY-MM-DD]` e
`tasks-done <listId> <taskId>`. Li usano `vedetta-esterna` (apre il ticket quando
un sito e' rotto) e `coda-l1` (il tap "Fatto" lo chiude): prima passavano da
`POST :3000/api/gworkspace/tasks`, adesso no. Era il residuo #1 di
`pilastri/README.md`.

Output JSON. **Il calendario resta sola lettura**, e non per convenzione:
`entry.sh` lo inchioda a `events list` con lista bianca dei flag, e i due comandi
di scrittura girano con `gog --enable-commands=tasks.add|tasks.done` — anche se
qualcuno infilasse altro in argv, e' gog stesso a rifiutare.

## Requisiti
- Binario `gog` in `/home/frede/.local/bin/gog`, autenticato (`gog auth manage`).
- Le credenziali keyring sono fornite al server via `~/.agentic-os/gog.env`.
