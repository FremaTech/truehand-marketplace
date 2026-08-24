# Scrittore (writer) — word processor di Agentic OS

App di produttività in stile MS Word. L'utente la usa via UI in `/writer` (foglio A4,
ribbon, stili, tabelle, immagini, multi-documento, autosave, export HTML).
Tu (agente) puoi creare e modificare gli STESSI documenti via CLI: l'utente li vedrà
comparire nell'elenco "Apri" dell'app.

## Come invocare
```
POST /api/apps/writer/run
body: {"args": ["<comando>", "<arg1>", "<arg2>"]}
```
La risposta è `{ ok, exitCode, stdout, stderr }`; `stdout` contiene JSON.

## Comandi

### list — elenca i documenti
```json
{"args":["list"]}
```
→ `{"docs":[{"id":"...","title":"...","updatedAt":"...","words":42}]}`

### read — leggi un documento
```json
{"args":["read","<id>"]}
```
→ `{"id":"...","title":"...","html":"<p>...</p>","updatedAt":"..."}`

### create — crea un documento vuoto
```json
{"args":["create","Lettera al cliente"]}
```
→ `{"id":"<nuovo-id>"}`

### append — accoda testo o HTML in coda al documento
```json
{"args":["append","<id>","<p>Gentile cliente,</p><p>con la presente...</p>"]}
```
Se passi testo semplice (senza tag) viene avvolto automaticamente in un paragrafo.
→ `{"ok":true,"id":"<id>","words":128}`

### help
```json
{"args":["--help"]}
```

## Pattern tipico (scrivere una lettera)
1. `create` con il titolo → ottieni `id`
2. uno o più `append` con i paragrafi (puoi usare HTML: `<h1>`, `<p>`, `<b>`, `<ul><li>`, tabelle)
3. comunica all'utente che il documento è pronto in /writer

## Storage
I documenti vivono in `~/.agentic-os/apps/writer/data/docs/<id>.json` — lo stesso
storage usato dalle API Next (`/api/writer/docs`) e dalla UI. CLI, API e UI sono sempre coerenti.
