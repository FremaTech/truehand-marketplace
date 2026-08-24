# AOS Developer Skill

The AOS Developer is a native agent that **evolves Agentic OS from inside the platform itself**. It has full access to the codebase, can run commands, modify files, restart services, and push to GitHub.

---

## Quick Reference

```
URL                  /aos-dev   (redirects to /native-agents?profile=aos-developer)
Profile id           aos-developer
Default model        qwen3-coder:480b-cloud  (cloud Ollama)
Provider             ollama-cloud
Working dir          /home/frede/agentic-os
Repository           TUO_UTENTE/TUO_REPO  (private GitHub)
Dev server           systemd user service `agentic-os-dev.service` → localhost:3000
```

---

## Tools available

| Tool | What it does |
|------|--------------|
| `shell` | Run bash. Has access to git, gh, npm, node, ollama, codex, hermes, openclaw, gog, agentic-wfb, agentic-icon, agentic-image, agentic-app, agentic-browser |
| `read_file` | Read any file in the repo |
| `write_file` | Overwrite a file entirely (for surgical edits use shell + sed) |
| `aos_api` | Call any internal API (`/api/vitals`, `/api/services`, `/api/desktop/state`, ...) |
| `memory_search` | Search Vault + codebase via ripgrep + semantic embeddings |
| `web_fetch` / `web_search` | Read docs (Next.js, Lucide, MDN, ...) |
| `task_*` | Plan and track work — `task_create`, `task_update`, `task_list`, `task_done` |
| `session_*` | Cross-session explorer for context |
| `list_aos_apps` / `run_aos_app` | Discover and invoke other AOS apps |
| `get_desktop_state` | See what windows Frede has open |

---

## Switching the model

The AOS Developer's underlying LLM is **configurable**. By default it uses `qwen3-coder:480b-cloud` (Qwen3 Coder 480B via Ollama Cloud), but you can switch it to any model the system has registered.

### From the UI
Open the AOS Developer app, click the model badge in the header, choose a different cloud or local model. Suggested options:

| Model | When to use |
|-------|-------------|
| `qwen3-coder:480b-cloud` | **Default.** Best for pure coding, refactoring, large surface area changes |
| `deepseek-v4-pro:cloud` | Reasoning-heavy tasks, debugging complex bugs, architecture decisions |
| `kimi-k2.6:cloud` | Research, long context, exploring unfamiliar codebases |
| `glm-5.1:cloud` | Fast iterations, simpler edits, cheap |

### From settings
The profile is stored at `~/.agentic-os/native-agents/profiles/aos-developer.json` — edit `model` and `provider` directly, or use the UI in `/native-agents` (which writes back to that file).

---

## Standard workflow

When asked to develop something inside AOS, the agent should:

1. **Plan** — `task_create` 3–7 concrete steps before starting non-trivial work.
2. **Explore** — `shell ls/find/grep`, `read_file`, `memory_search` to understand the area.
3. **Edit** — `write_file` (passes whole file) or `shell` with `sed`/`awk` for surgical patches.
4. **Verify** — `npx tsc --noEmit` and/or `curl http://localhost:3000/PATH` smoke test.
5. **Restart** — `systemctl --user restart agentic-os-dev.service && sleep 8` when new routes are added.
6. **Commit** (only after explicit approval from Frede):
   ```bash
   cd /home/frede/agentic-os
   git add -A && git commit -m "feat(...): ..."
   git push origin main
   ```

---

## Guardrails

- **Stay in** `/home/frede/agentic-os`. Do not touch `~/.openclaw`, `~/.hermes`, `~/Vault` without an explicit request.
- **Never push without asking** — `git push` requires Frede's go-ahead.
- For installs: `cd /home/frede/agentic-os && npm install X` (no `--workspaces`).
- New Next.js routes require restarting the dev server (`systemctl --user restart agentic-os-dev.service`).
- Show a unified-diff patch when proposing non-trivial changes before applying them.

---

## Example prompts

> "Aggiungi una pagina /todo con CRUD su una lista persistente in ~/.agentic-os/todo.json. Includi API e un widget per la desktop2."

> "Verifica i typing errors nel codebase con tsc e fixali."

> "Aggiungi un endpoint /api/health che restituisce versione, uptime e stato servizi systemd. Poi mostralo come widget in Mission Control."

> "Refattorizza src/lib/native-agents/profiles.ts per estrarre la seed-logic in un file separato."

> "Crea una nuova AOS-App 'gold-prices' che mostra il prezzo dell'oro in tempo reale da Yahoo Finance."
