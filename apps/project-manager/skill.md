# Project Manager — Skill

Orchestratore di progetti AOS basato su **blueprint YAML**. Decompone obiettivi complessi in fasi con deliverable, agenti dedicati e gate criteria. Materializza automaticamente card Kanban quando una fase si attiva.

## Quando usarlo

- L'utente vuole "creare un nuovo progetto" di tipo riconoscibile (website, ecommerce, automazione, integrazione AOS)
- L'utente chiede "dove sono nel progetto X?" o "cosa manca?"
- Devi spezzare un goal complesso in task tracciabili
- Devi avanzare una fase di progetto verificando le condizioni

## Tool disponibili

- `aos_project_create_from_blueprint(blueprint_id, name, variables?)` — istanzia progetto da blueprint
- `aos_project_list({status?})` — elenco progetti attivi con progress
- `aos_project_status(project_id)` — dettaglio: fase corrente, gate, card, documenti
- `aos_project_advance_phase(project_id, force?)` — avanza alla fase successiva (con gate check)
- `aos_blueprint_list()` — blueprint disponibili (template)

## Blueprint installati

- `website-vetrina` (4 fasi) — sito vetrina semplice
- `ecommerce-base` (8 fasi) — lancio ecommerce
- `automazione-workflow` (8 fasi) — pipeline integrazione
- `aos-app-development` (11 fasi) — sviluppo nuova app AOS (meta)

## Storage

- DB: `~/.agentic-os/projects.db` (SQLite WAL)
- Blueprint YAML: `~/.agentic-os/blueprints/*.yaml`
- CLI: `agentic-blueprint list|show|validate|reload`
- API: `/api/project-manager/*`
- UI: `http://localhost:3000/project-manager`
