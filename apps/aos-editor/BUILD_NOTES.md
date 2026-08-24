# BUILD_NOTES.md — AOS Editor v2.0

**Data build:** 2026-06-11
**Versione:** 2.0.0 (Monaco)

---

## Stack

- **Monaco Editor** via CDN (`cdn.jsdelivr.net/npm/monaco-editor@0.52`)
- **SPA** self-contained (index.html + app.js + style.css)
- **Backend** entry.js (Node.js, comandi sandbox FS + exec)
- **Tema** AOS dark/gold (CSS custom properties)

## Fix applicati post-review

### Rilievo 1 — Chat endpoint
- **Problema**: la chat chiamava `/api/chat` (inesistente)
- **Fix**: redirect a `/api/apps/native-agents/run` (API esistente)
- **Stato**: ✅ Risolto — chat funziona con agenti nativi

### Rilievo 2 — Git integration
- **Problema**: comandi git non testati
- **Fix**: Non applicabile — entry.js v2 non ha comandi git (erano nella v1)
- **Stato**: ✅ Non rilevante

### Rilievo 3 — Monaco CDN vs self-host
- **Decisione**: CDN accettabile per MVP. In produzione valutare self-host.
- **Stato**: ✅ Accettato per ora

### Rilievo 4 — Typing indicator UX
- **Problema**: nessun feedback visivo durante attesa risposta agente
- **Fix**: aggiunto `.typing-indicator` con 3 pallini animati + `setStatus('Agente in elaborazione...')` nel flusso chat
- **File**: `ui/app.js` (funzione `sendChatMessage`), `ui/style.css` (regole `.typing-indicator` + `@keyframes typing-dot`)
- **Stato**: ✅ Risolto

### Rilievo 5 — CSS mancanti chat panel
- **Problema**: review segnalava .chat-panel, .chat-messages, ecc. mancanti
- **Verifica**: tutte le regole CSS erano già presenti nelle righe 204-286 di style.css
- **Stato**: ✅ Già presente (falso positivo della review)

### Rilievo 6 — Documentazione
- **Problema**: mancavano BUILD_NOTES.md e QA_REPORT.md
- **Fix**: questo file + QA_REPORT.md
- **Stato**: ✅ Risolto

## Debug

| Sintomo | Causa | Fix |
|---------|-------|-----|
| Chat non riceve risposta | Endpoint `/api/chat` inesistente | Redirect a `/api/apps/native-agents/run` |
| Nessun feedback durante attesa | Bubble vuota senza animazione | Typing indicator CSS + JS |

## Comandi

```bash
# Esegui test
cd ~/.agentic-os/apps/aos-editor && node test.js

# Typecheck (solo entry.js, è l'unico file JS backend)
node -c entry.js && echo "OK"
```

## Rotte

| Rotta | Servita da | Note |
|-------|-----------|------|
| `/ide` | AOS App `aos-editor` | UI principale (Monaco) |
| `/editor` | Vecchia app `editor` | CodeMirror, da deprecare |