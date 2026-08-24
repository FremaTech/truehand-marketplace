# AOS Editor — Skill

Editor di codice integrato in Agentic OS con **Monaco Editor**, terminale sandbox e pannello chat agente nativo.

## Come invocare il motore (agenti)

`POST /api/apps/aos-editor/run` con body `{"args": [<comando>, ...argomenti]}`.

Oppure via tool AOS: `run_aos_app({ app: "aos-editor", args: "<comando> <argomenti>" })`.

## Comandi

### `info`
Info sull'app e lista comandi disponibili.

```json
{"args": ["info"]}
```
Risposta: `{ ok, app, version, engine, workspace, commands }`

### `list` / `ls`
Elenca file e directory. Path relativo al workspace.

```json
{"args": ["list"]}
{"args": ["list", "src/components"]}
```
Risposta: `{ ok, path, files: [{ name, type, size }] }`

### `load`
Legge il contenuto di un file di testo. I file binary restituiscono errore.

```json
{"args": ["load", "src/app/page.tsx"]}
```
Risposta: `{ ok, path, content, size, modified }`

### `save`
Scrive un file. Crea le directory intermedie se necessario.

```json
{"args": ["save", "src/app/page.tsx", "export default function Page() { return <h1>Hello</h1> }"]}
```
Risposta: `{ ok, path, size }`

**Attenzione**: il contenuto è tutto ciò che segue il secondo argomento. Se il contenuto contiene spazi, viene comunque correttamente concatenato. Per contenuti lunghi o multilinea, preferisci passare il contenuto come singolo argomento escapato.

### `delete` / `rm`
Elimina un file.

```json
{"args": ["delete", "temp/old.ts"]}
```
Risposta: `{ ok, deleted }`

### `mkdir`
Crea una directory (con `-p` implicito).

```json
{"args": ["mkdir", "src/utils"]}
```
Risposta: `{ ok, created }`

### `rmdir`
Rimuove una directory vuota. Con `--force` la rimuove ricorsivamente.

```json
{"args": ["rmdir", "temp"]}
{"args": ["rmdir", "old-build", "--force"]}
```
Risposta: `{ ok, removed }`

### `rename` / `mv`
Rinomina o sposta un file/directory.

```json
{"args": ["rename", "old.ts", "new.ts"]}
```
Risposta: `{ ok, from, to }`

### `exec` / `run`
Esegue un comando shell nel workspace sandbox. Timeout 30s, max 1MB output.

```json
{"args": ["exec", "node", "-v"]}
{"args": ["exec", "npm", "test"]}
```
Risposta: `{ ok, command, output, exitCode }` oppure `{ ok: false, error, exitCode }`

### `stat`
Metadata di un file o directory.

```json
{"args": ["stat", "package.json"]}
```
Risposta: `{ ok, name, path, size, isFile, isDir, modified, created }`

### `search`
Cerca file per nome (case-insensitive) nel workspace. Profondità max 10 livelli.

```json
{"args": ["search", "config"]}
```
Risposta: `{ ok, pattern, results: [{ path, name, size }], count }`

### `agent-chat`
Invia un messaggio alla chat dell'agente nativo (delega al sistema agenti).

```json
{"args": ["agent-chat", "Spiega questo errore: TypeError at line 42"]}
```
Risposta: `{ ok, message, note }`

### `workspace`
Gestisce workspace multipli.

```json
{"args": ["workspace", "list"]}
{"args": ["workspace", "add", "mio-progetto"]}
{"args": ["workspace", "add", "mio-progetto", "/percorso/assoluto"]}
{"args": ["workspace", "remove", "mio-progetto"]}
```
Risposta varia per sottocomando.

## Workspace e Sandbox

- **Directory default**: `~/.agentic-os/apps/aos-editor/data/`
- **Sandbox**: tutte le operazioni su file sono confinate nella directory del workspace. I path che tentano di uscire (`../`, path assoluti fuori sandbox) vengono rifiutati con `SANDBOX VIOLATION`.
- **Workspace multipli**: usa `workspace add <nome> [path]` per creare workspace separati. Ogni workspace ha la sua sandbox isolata.

## Workflow tipici

### Leggere un progetto e analizzarlo
```json
{"args": ["list"]}
{"args": ["load", "src/index.ts"]}
{"args": ["stat", "package.json"]}
```

### Creare un file e verificarlo
```json
{"args": ["mkdir", "src/components"]}
{"args": ["save", "src/components/Button.tsx", "export const Button = () => <button>Click</button>"]}
{"args": ["load", "src/components/Button.tsx"]}
```

### Cercare file per nome
```json
{"args": ["search", "config"]}
```

### Eseguire test nel workspace
```json
{"args": ["exec", "npm", "test"]}
```

## Errori comuni

| Errore | Causa | Soluzione |
|--------|-------|-----------|
| `SANDBOX VIOLATION` | Path fuori dal workspace | Usa path relativi al workspace |
| `File not found` | File inesistente | Verifica con `list` o `search` |
| `Directory not empty` | `rmdir` su directory non vuota senza `--force` | Aggiungi `--force` |
| `Binary file` | Tentativo di `load` su file binario | Usa `stat` per info, `exec` per ispezionare |
| `Usage: save <filepath> <content>` | Contenuto vuoto | Fornisci il contenuto come terzo argomento |

## UI

L'editor è accessibile nel browser alla rotta `/ide`. La UI offre:
- **Monaco Editor** con syntax highlighting, autocompletamento, minimap
- **File tree** navigabile nel sidebar
- **Terminale** sandbox integrato
- **Chat agente** nativa nel pannello laterale

La UI e il motore CLI condividono lo stesso workspace e gli stessi file.