# AOS Editor — Design Document v2

## Visione

IDE integrato in Agentic OS, stile VS Code/Cursor. Monaco Editor per editing professionale, file tree navigabile, terminale sandbox e pannello chat con agenti nativi. Due velocità: UI runtime (`ui/`) servita live senza build, backend (`entry.js`) via run API.

## Differenze dalla v1 (`editor`)

| Aspetto | v1 (CodeMirror 6) | v2 (Monaco) |
|---|---|---|
| Editor | CodeMirror 6, bundle custom | Monaco Editor 0.52 via CDN |
| Intellisense | No | Si (completamento, hover, diagnostics) |
| Minimap | No | Si |
| Diff viewer | No | Disponibile nell'API Monaco |
| Multi-cursore | Limitato | Nativo Monaco |
| Chat agente | Placeholder | Streaming SSE verso `/api/apps/native-agents/run` |
| Terminale | xterm.js (pianificato) | Div con prompt `$`, esecuzione via `exec` |

## MVP Features

1. **File tree** — navigazione albero con icone per tipo file, click per aprire, collapse/expand, ordinamento (dirs prima, poi files)
2. **Monaco Editor** — syntax highlight (25+ linguaggi), intellisense, multi-tab, minimap, tema custom "aos-dark", Ctrl+S salva
3. **Terminale sandbox** — esegue comandi shell via API `exec`, output in tempo reale, history con frecce ↑↓
4. **Chat agente** — comunicazione reale con agenti nativi (profile selezionabile: default, deepseek, deepseek-pro, strategist, analyst, reviewer, scout, prototyper, team-frematech)
5. **StatusBar** — file corrente, riga/colonna, status connessione, workspace

## Architettura

```
~/.agentic-os/apps/aos-editor/
├── manifest.json          # Metadati app (id, version, ui, skill, permissions)
├── skill.md               # Documentazione per agenti
├── entry.js                # Motore CLI: 17 comandi
├── test.js                 # Test suite (9 test)
├── DESIGN.md               # Questo file
├── ui/
│   ├── index.html          # SPA completa (toolbar, sidebar, editor, terminale, chat)
│   ├── app.js              # Logica UI (IIFE singolo file, ~650 righe)
│   └── style.css           # Tema scuro/oro AOS (~300 righe)
├── data/                   # Sandbox predefinita (workspace "default")
│   └── .workspaces.json    # Registry workspace → path
└── logs/                   # Log JSONL dell'app
```

## Stack tecnologico

- **Editor**: Monaco Editor v0.52 via CDN (`https://cdn.jsdelivr.net/npm/monaco-editor@0.52/min/vs`)
  - Caricamento AMD via `require.config` — niente build step
  - Tema custom `aos-dark` (vs-dark base + accent oro `#d4a853`)
- **Terminale**: div con prompt `$`, input inline, output scrollabile. Comandi via `exec` API
- **Chat**: fetch POST verso `/api/apps/native-agents/run` con body `{profileId, message}`. Stream di risposta mostrato nel pannello
- **File tree**: div ricorsivo con collapse/expand, icone SVG inline per tipo file
- **Font**: Inter (UI), JetBrains Mono (editor), via Google Fonts CDN
- **Zero build**: tutto vanilla JS (IIFE singolo file), niente bundler, niente TypeScript

## Comandi entry.js — Referenza completa

### Firma generale

Input: `process.argv.slice(2)` → `[command, ...args]`
Output: `process.stdout.write(JSON.stringify(result))` — singola riga JSON
Eccezioni: errori fatali → `{ ok: false, error: message }`

### Tabella comandi

| Comando | Args | Descrizione | Output |
|---|---|---|---|
| `info` | — | Info app, versione, comandi disponibili | `{ ok, app, version, engine, workspace, commands[] }` |
| `list` \| `ls` | `[subdir?]` | Elenca file/dir nella workspace (default: root) | `{ ok, path, files[{name, type, size}] }` |
| `load` | `<filepath>` | Legge file di testo | `{ ok, path, content, size, modified }` |
| `save` | `<filepath>` `<content>` | Scrive file (join args[1+]); crea dirs intermedie | `{ ok, file, saved, bytes }` |
| `delete` \| `rm` | `<path>` | Elimina file o directory (recursive) | `{ ok, deleted, wasDir }` |
| `mkdir` | `<dirpath>` | Crea directory ricorsiva (mkdir -p) | `{ ok, created }` |
| `rmdir` | `<dirpath>` | Rimuove directory vuota | `{ ok, removed }` |
| `rename` \| `mv` | `<old>` `<new>` | Rinomina/sposta file o directory | `{ ok, renamed, from, to }` |
| `stat` | `<path>` | Info file (size, mtime, type, isDir) | `{ ok, path, size, mtime, isDir, type }` |
| `search` | `<query>` `[path?]` | Cerca nei nomi file (case-insensitive) | `{ ok, query, results[{name, path, type, size}] }` |
| `exec` \| `run` | `<command>` | Esegue shell command in sandbox (singolo arg stringa) | `{ ok, stdout, stderr, exitCode }` |
| `workspace` | `<sub>` `[args...]` | Gestione workspace: `list`, `add <name> [dir]`, `remove <name>`, `<name>` (seleziona) | `{ ok, workspaces[] }` o `{ ok, name, path }` |
| `agent-chat` | `<profile>` `<message>` | Prepara payload per agente nativo | `{ ok, profile, message, endpoint }` |
| `set-workdir` | `<path>` | Imposta cartella di lavoro per la sessione corrente | `{ ok, workdir, previous }` |

### Sicurezza sandbox

- **`resolveSafe(filePath, cwd)`**: `path.resolve` + verifica che il risultato sia dentro la sandbox. Lancio di `Error` se path-traversal rilevato.
- **`exec`**: esecuzione con `{ shell: true }` per pipe/redirections, ma `cwd` è la sandbox. Timeout 30s.
- **Nessun accesso** fuori dalla cartella di lavoro (data/ o workspace custom).
- **`set-workdir`**: valida che il nuovo path sia sotto `~/.agentic-os/` e che esista.
- **File binari**: rifiutati da `load` (estensioni: .png, .jpg, .zip, .exe, .dll, etc.)

## Schema dati

### Workspace registry (`data/.workspaces.json`)

```json
{
  "default": "/home/frede/.agentic-os/apps/aos-editor/data",
  "my-project": "/home/frede/.agentic-os/apps/aos-editor/data/my-project"
}
```

- Chiave: nome workspace (stringa alfanumerica)
- Valore: path assoluto della directory
- Il workspace `default` punta sempre a `data/`
- `workspace add <name> [dir]` → crea entry + directory fisica
- `workspace remove <name>` → rimuove entry (non cancella i file)

## Tema AOS — Variabili CSS

```css
:root {
  --bg: #0d1117;           /* background principale */
  --bg-secondary: #161b22; /* sidebar, header, tab bar */
  --bg-tertiary: #21262d;   /* hover, selection, terminal bg */
  --border: #30363d;        /* bordi, separatori */
  --text: #e6edf3;          /* testo primario */
  --text-dim: #8b949e;     /* testo secondario */
  --accent: #d4a853;        /* oro AOS — accent principale */
  --accent-hover: #e8c068; /* oro chiaro — hover */
  --success: #5ab896;      /* verde — operazioni riuscite */
  --error: #f85149;         /* rosso — errori */
  --warning: #d29922;       /* arancione — avvisi */
}
```

Font: `Inter` per UI, `JetBrains Mono` per editor e terminale.

## Layout UI

```
┌──────────────────────────────────────────────────────────────┐
│ Toolbar: [💾 Salva] [📄 Nuovo] [🔄 Refresh] [📂 Apri dir]  ⬤ │
├──────────┬───────────────────────────────┬──────────────────┤
│  ESPLORA │  Tab1  Tab2  [+]              │    Chat Agente    │
│ ⊟ collapse│───────────────────────────────│                  │
│          │                               │  Profile: [▼]    │
│ 📁 src   │                               │                  │
│ 📄 app.js│    Monaco Editor               │  🧑 Ciao...      │
│ 📄 style │    (syntax highlight,          │  🤖 Certo...     │
│          │     minimap, intellisense)      │                  │
│          │                               │                  │
│          ├───────────────────────────────┤  [input...]      │
│          │  Terminale $ _                │  [Invia]          │
│          │  > output...                  │                  │
├──────────┴───────────────────────────────┴──────────────────┤
│ ● Pronto  |  app.js  |  Ln 42, Col 15  |  workspace: default│
└──────────────────────────────────────────────────────────────┘
```

### Componenti

1. **Toolbar** (`#toolbar`): pulsanti Salva, Nuovo, Refresh, Apri dir + indicatore connessione
2. **Sidebar** (`#sidebar`): header "ESPLORA" + collapse-all, file tree scrollabile
3. **Editor area** (`#editor-area`): tab bar + Monaco container
4. **Terminal panel** (`#terminal`): header con toggle + output scrollabile + input prompt
5. **Chat panel** (`#chat-panel`): header con selettore profilo + messaggi + input
6. **Status bar** (`#status-bar`): status testo + file corrente + cursore + workspace

### Interazioni tastiera

- **Ctrl+S**: salva file corrente (action Monaco)
- **Ctrl+Enter**: invia messaggio chat
- **Enter** nel terminale: esegue comando
- **↑/↓** nel terminale: history comandi
- **Tab** nel file input: autocompletamento

## API endpoints UI

La SPA chiama esclusivamente:

| Endpoint | Metodo | Scopo |
|---|---|---|
| `/api/apps/aos-editor/run` | POST | Tutti i comandi del motore (body: `{args: [cmd, ...]}`) |
| `/api/apps/native-agents/run` | POST | Chat con agente (body: `{profileId, message}`) |

Nessuna chiamata diretta al filesystem — tutto passa dal backend entry.js.

## Cosa espone agli agenti via skill.md

La skill (`exposeAs: "editor"`) documenta i comandi per gli agenti:
- `info` — capabilities dell'app
- `list` / `ls` — esplorare directory
- `load` / `save` — leggere e scrivere file
- `delete` / `mkdir` / `rename` — operazioni filesystem
- `exec` — eseguire comandi shell nella sandbox
- `workspace` — gestire workspace multipli
- `agent-chat` — comunicare con altri agenti nativi

La skill è la fonte di verità per gli agenti; il DESIGN.md è la fonte di verità architetturale per gli sviluppatori.

## Limitazioni note (MVP)

1. **Terminale non è xterm.js**: è un div con prompt. Niente PTY, niente ANSI colors, niente processi lunghi. Per comandi lunghi usare `exec` con timeout 30s.
2. **Chat non è streaming SSE**: la risposta dell'agente viene mostrata dopo completamento (fetch normale). Streaming richiederebbe adapter SSE lato server.
3. **File tree è flat**: `list` ritorna una singola directory; la UI fa ricorsione client-side per l'albero completo.
4. **No diff viewer UI**: l'API Monaco lo supporta ma non è ancora esposto nella UI.
5. **No git integration**: pianificato per post-MVP (git status, stage, diff, commit).
6. **Monaco caricato via CDN**: richiede connessione internet per il primo caricamento. Dopo il caching del browser funziona offline.

## Piano evoluzione post-MVP

1. **Git panel**: status, stage, commit, diff, log — via comando `git` in entry.js
2. **xterm.js**: terminale PTY reale con ANSI colors e processi long-running
3. **Streaming chat**: SSE per risposte agenti in tempo reale
4. **Diff viewer**: tab diff per modifiche non salvate, confronto versioni
5. **Search & replace**: Find/Replace nel editor con regex support
6. **Multi-workspace tab**: aprire più workspace contemporaneamente
7. **Settings**: font size, theme, tab size, keybindings personalizzabili