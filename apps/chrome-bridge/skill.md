# Chrome Reale (chrome-bridge)

Puoi pilotare il **browser Chrome REALE** di Signor Frede — con le **sue sessioni e i suoi login già attivi** — tramite l'app `chrome-bridge`.

## Come si chiama (leggi PRIMA di provare)

Si usa con il tool **`run_aos_app`**, così:

```
run_aos_app  app: "chrome-bridge"   args: "click \"Apply now\""
```

Tre regole che fanno la differenza fra funzionare e girare a vuoto:

1. Il nome dell'app è **`chrome-bridge`** con il **trattino**. Con l'underscore non esiste.
2. `args` è **una stringa sola**, comando e argomenti insieme — non un array JSON.
3. Un bersaglio di **più parole va fra virgolette**: `click "Apply now"`, non `click Apply now`.

Non serve `curl`, non serve `bash entry.sh`, non serve cercare l'eseguibile: passa
tutto da `run_aos_app`. Se una chiamata fallisce, **leggi l'errore** — dice quale
comando non ha riconosciuto — invece di cambiare strada.

## Quando usare QUESTO e non il browser interno

Agentic OS ha **due** browser distinti. Scegli bene:

| | `chrome-bridge` (QUESTO) | `browser` / app `browser-tool` |
|---|---|---|
| Cos'è | Chrome reale dell'utente via estensione | Browser **headless** Playwright interno |
| Login/sessioni | **Quelli dell'utente** (Gmail, Upwork, banche…) | Profili separati, da loggare a parte |
| Anti-bot | Lo evita (sei un browser vero) | Spesso bloccato (Cloudflare, ecc.) |
| Screenshot | Sì, mostrabile in chat | — |
| Usalo per | Siti che richiedono il login dell'utente, anti-bot, "guarda cosa c'è sul mio schermo" | Navigazione anonima/automatica headless |

Se il compito tocca un sito dove **l'utente è già loggato** o che blocca i bot, usa **chrome-bridge**. Per scraping anonimo headless va bene il tool `browser`.

## Comandi

### Comandi base

| Comando | Sintassi | Descrizione |
|---|---|---|
| `status` | `status` | Verifica che l'estensione sia connessa. **Prima di tutto.** |
| `tabs` | `tabs` | Elenca le tab aperte. |
| `navigate` | `navigate <url>` | Va all'URL nella tab agente dedicata, ritorna testo+link. |
| `extract` | `extract` | Ri-estrae il contenuto della pagina corrente. |
| `click` | `click <selettore-o-testo>` | Click reale per selettore CSS o testo visibile. |
| `type` | `type <campo> <testo>` | Scrive in un campo (per nome/placeholder/selettore). |
| `key` | `key <tasto>` | Preme un tasto (Enter, ArrowDown, Escape, Tab, ecc.). |
| `screenshot` | `screenshot` | Cattura la pagina visibile. |

### Comandi avanzati

| Comando | Sintassi | Descrizione |
|---|---|---|
| `map` | `map` | **Il comando di lettura migliore.** Mappa unica di TUTTO: bottoni, link, campi, checkbox/radio con stato (checked/disabled) e coordinate. Vede anche dentro gli iframe e lo shadow DOM. Leggi la mappa, poi clicca per testo o con `click_xy`. |
| `eval` | `eval <codice js>` | Esegue JavaScript nella pagina e ritorna il valore. Per tutto ciò che gli altri comandi non coprono: leggere uno stato, forzare un valore, controllare una condizione. |
| `console` | `console [n]` | Ultimi messaggi console della tab, errori JS compresi. Se un form non parte, guarda QUI prima di riprovare a caso. |
| `network` | `network [filtro] [n]` | Ultime richieste di rete (status, errori). Distingue un 403/429 da una pagina lenta. |
| `wait_for` | `wait_for <selettore-o-testo>` | Attende che un elemento appaia nella pagina (max 15s). Ideale per SPA che caricano async. |
| `inspect` | `inspect` | Elenca i campi input della pagina, iframe inclusi (tipo, nome, placeholder, selettore). |
| `buttons` | `buttons` | Elenca i bottoni clickabili (testo, selettore). Per scoprire le azioni disponibili. |
| `hover` | `hover <selettore-o-testo>` | Muove il mouse sopra un elemento senza cliccare: apre i menu a comparsa. |
| `insert` | `insert <campo> <testo> [replace]` | Battitura reale via CDP: per editor rich (lettere di presentazione, commenti) dove `type` può perdere il testo. Con `replace` svuota prima il campo. |
| `upload` | `upload <file> [selettore]` | Mette un file in un `input type=file` senza aprire il dialog. Percorsi WSL vanno bene. |
| `back` / `forward` | `back` | Torna indietro/avanti nella cronologia della tab. |
| `select` | `select <selettore> <valore>` | Sceglie un'opzione in un `<select>` dropdown. Impossibile gestire dropdown senza questo. |
| `scroll` | `scroll <direzione>` | Scrolla la pagina. Direzioni: up, down. Necessario per pagine lunghe. |
| `click_xy` | `click_xy <x> <y>` | Click preciso per coordinate pixel. Utile quando click by text/selettore fallisce. |
| `agent_tab` | `agent_tab` | Crea (o ottiene) la tab agente dedicata. Ritorna il tabId. |

### Gestione tab

| Comando | Sintassi | Descrizione |
|---|---|---|
| `tab_open` | `tab_open <url>` | Apre una nuova tab e ci naviga. Utile per multi-tab. |
| `diagnose` | `diagnose` | Stato del ponte e della pagina quando qualcosa non torna. |
| `tab_close` | `tab_close <tabId>` | Chiude una tab per ID. |
| `tab_activate` | `tab_activate <tabId>` | Attiva (focus) una tab per ID. |

## Esempi d'uso

### Compilare un form complesso
```
1. status                           # verifica estensione connessa
2. navigate https://example.com/form
3. wait_for form-submit-button      # aspetta che il form carichi
4. inspect                          # vedi quali campi ha il form
5. select #country Switzerland      # scegli da un dropdown
6. type #name "Mario Rossi"         # due parole -> VIRGOLETTE
7. click "Invia richiesta"          # idem per il bottone
8. screenshot                       # verifica visivamente
```

### Navigazione multi-tab
```
1. tab_open https://example.com/page2   # apri in nuova tab
2. extract                             # leggi contenuto
3. tab_close <tabId>                   # chiudi tab specifica
4. tab_activate <tabId>                # torna a una tab esistente
```

### Click preciso per coordinate
```
1. screenshot                       # vedi la pagina
2. click_xy 450 320                 # clicka alle coordinate esatte
```

## Screenshot → mostralo in chat (IMPORTANTE)

Quando fai `screenshot`, il tool ritorna un JSON con il campo **`show_in_chat`**, ad esempio:

```
{"ok":true,"image_url":"/artifacts/cb-shot-1234.png","show_in_chat":"![screenshot](/artifacts/cb-shot-1234.png)"}
```

**Per far vedere lo screenshot a Signor Frede, copia esattamente il valore di `show_in_chat` nella tua risposta** (è markdown immagine: la chat lo renderizza inline). Fallo ogni volta che un riscontro visivo aiuta: dopo una navigazione importante, per confermare un'azione, o quando l'utente chiede "fammi vedere".

Regola pratica: **naviga → (agisci) → screenshot → incolla `show_in_chat`** così l'utente vede ciò che vedi tu.

## Auto-discovery e connessione (v1.2.0)

L'estensione Chrome Bridge v1.2.0 usa un meccanismo di **auto-discovery a 4 livelli** per trovare il server bridge su WSL2, senza dover configurare manualmente l'IP:

1. **URL salvato** — controlla `chrome.storage.local` per un `bridgeUrl` precedentemente salvato
2. **localhost** — prova `http://localhost:47800/health` (funziona se WSL2 ha mirror networking attivo)
3. **Ultimo IP noto** — usa l'ultimo IP WSL salvato dal discovery
4. **Scan subnet** — probe parallelo degli IP `172.27.x.x` sulla porta 47800 per trovare il server

Il server espone `GET /wsl-ip` che ritorna gli IP WSL raggiungibili da Windows, e `GET /health` per il health check dell'estensione.

**Keepalive MV3**: l'estensione usa `chrome.alarms` a intervalli di 24 secondi per mantenere attivo il service worker di Manifest V3. Se la connessione cade, il discovery si riattiva automaticamente al prossimo ciclo.

### Risoluzione problemi

- **`status` dice non connesso**: verificare che Chrome sia aperto con l'estensione aggiornata caricata e che il servizio WSL sia attivo (`systemctl --user status chrome-bridge`)
- **IP non trovato**: verificare rete WSL2 (`hostname -I` in WSL, dovrebbe mostrare un IP `172.27.x.x`)
- **Estensione non polla**: ricaricare l'estensione in `chrome://extensions` (Developer mode → Reload)

## Limiti e sicurezza

- **Non digitare mai password.** Se un sito chiede il login, fermati e chiedi a Signor Frede di autenticarsi lui; tu riprendi dopo.
- Sei in un browser reale: niente azioni distruttive o irreversibili senza conferma esplicita dell'utente.