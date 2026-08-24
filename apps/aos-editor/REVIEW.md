# AOS Editor (Monaco) — Code Review

**Data**: 2026-06-11  
**Reviewer**: native (Claude)  
**Target**: ~/.agentic-os/apps/aos-editor/ — entry.js (355 righe) + ui/app.js (801 righe) + ui/style.css (370 righe) + ui/index.html (91 righe)

## Coerenza con DESIGN.md

Il codice implementa fedelmente il DESIGN.md: layout, componenti, comandi, workspace management, terminale, chat agente. Nessuna deviazione significativa.

## Risultati — Per Severita

### CRITICAL (FIXED)

**1. XSS via innerHTML con dati controllabili dall utente**

4 siti in app.js interpolavano variabili in innerHTML senza escape:

| Linea | Contesto | Variabile | Rischio |
|-------|----------|-----------|---------|
| 211 | Tree item name | name (nome file/directory) | Esecuzione script arbitrario |
| 257 | Sorted tree item name | item.name | Esecuzione script arbitrario |
| 416 | Tab bar name | shortName (derivato da path file) | Esecuzione script arbitrario |
| 639 | Chat bubble text | text (messaggio agente) | Esecuzione script arbitrario |

**Fix applicato**: Aggiunta funzione escapeHtml() a livello modulo (linea 25), applicata a tutte e 4 le interpolazioni. Rimossa definizione duplicata che era a linea 645.

### HIGH

**2. resolveSafe path traversal — bypass potenziale**

resolveSafe(path.resolve(base, filePath)) confronta con startsWith(base + path.sep). Puo essere bypassato se:
- base e un prefisso di un altra directory (es. /data vs /data-backup)
- filePath contiene .. che dopo resolve atterra in una directory che inizia per base come suffisso

**Raccomandazione**: Aggiungere path.normalize() e verificare che il resolved path sia esattamente sotto base dopo normalizzazione.

**3. cmd_exec command injection**

Il comando ricevuto viene eseguito con shell:true. La blocklist copre i pattern piu ovvi ma mancano: redirection (> >> 2>), command substitution dollaro-parentesi, backtick, concatenazione (e commerciale e pipeline (pipe). Un utente con accesso all editor puo eseguire arbitrariamente comandi shell.

**Raccomandazione**: Estendere la blocklist o, meglio, rimuovere shell:true e usare execSync con args array (senza shell).

**4. workspace add permette creazione directory arbitrarie**

workspace add nome /etc crea una directory in /etc e la registra come workspace. Non c e sandbox check sul percorso.

**Raccomandazione**: Validare che workspace add accetti solo percorsi sotto DATA_DIR o HOME.

### MEDIUM

**5. cmd_list espone percorsi assoluti**

Il campo path nei risultati e il percorso assoluto completo, che rivela la struttura del filesystem del server al client.

**Raccomandazione**: Restituire percorsi relativi alla workspace root.

**6. cmd_save tronca contenuto su spazi**

args.slice(1).join(" ") ricostruisce il contenuto unendo gli argomenti con spazi, ma perde la formattazione originale (tabulazioni, newline multipli).

**Raccomandazione**: Per file grandi, usare un encoding base64 o passare il contenuto via stdin.

**7. Nessun limite su dimensione file per save**

Un client puo scrivere file di dimensione arbitraria sul disco.

**Raccomandazione**: Aggiungere un limite (es. 1MB) sul contenuto.

**8. cmd_search nessun limite sul numero di risultati**

La ricerca ricorsiva puo produrre migliaia di risultati su directory grandi.

**Raccomandazione**: Aggiungere un limite (es. maxResults: 200).

**9. Monaco caricato da CDN senza SRI**

Il tema e il loader Monaco vengono caricati da jsdelivr senza integrity check. Un compromissione del CDN o MITM puo iniettare codice malevolo.

**Raccomandazione**: Aggiungere integrity hash (SRI) ai tag script, o self-hostare Monaco.

### LOW

**10. cmd_agent_chat e uno stub**

Ritorna un messaggio che dice di usare la UI, ma non esegue nessuna azione. Non e un bug ma la funzione e registrata come comando.

**11. Nessuna autenticazione**

Chiunque puo chiamare le API dell editor. In un contesto locale questo e accettabile, ma in deployment pubblico sarebbe critico.

**12. set-workdir permette HOME come root**

allowedRoots include process.env.HOME, che permette di impostare qualsiasi directory sotto la home dell utente come workdir.

## Fix Applicati in Questa Review

1. **app.js:25**: Aggiunta funzione escapeHtml() globale
2. **app.js:218**: Tree item name ora usa escapeHtml(name)
3. **app.js:264**: Sorted tree item name ora usa escapeHtml(item.name)
4. **app.js:423**: Tab name ora usa escapeHtml(shortName)
5. **app.js:639**: Chat bubble text usa gia escapeHtml(text) (funzione ora disponibile a livello modulo)
6. **app.js:645-649**: Rimossa definizione duplicata di escapeHtml (era sotto appendChatMessage)

Tutti i fix verificati con grep: nessun innerHTML con interpolazione di variabili non escapate rimasto.

## entry.js — Note Specifiche

- Tutte le funzioni ritornano JSON valido (ok:true o ok:false con error). Coerente con DESIGN.md.
- Nessun segreto o credenziale nel codice.
- Logging su file (logs/editor.log) senza rotazione — puo crescere indefinitamente su uso intensivo.
- cmd_delete non ha cestino (skip trash pattern: direttamente fs.unlinkSync). Considerare spostare in ~/.agentic-os/trash/ per sicurezza.
- cmd_rmdir con --force usa rmSync recursive:true che elimina senza conferma.

## ui/style.css + ui/index.html

- CSS coerente con le variabili definite in DESIGN.md.
- Nessun issue di accessibilita critico (contrasto testo/bg sufficiente sui colori principali).
- HTML usa semantic tags corretti (main, header, aside, section).
- index.html carica font da Google Fonts CDN senza SRI (stesso rischio di punto 9).
