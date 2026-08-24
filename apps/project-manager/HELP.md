# Project Manager

Progetti & Lavoro · /project-manager

## Cosa fa
Orchestratore di progetti costruito sopra il Kanban: parte da un blueprint YAML che descrive fasi, deliverable e gate criteria, e man mano che le fasi si attivano materializza le card Kanban necessarie assegnandole agli agenti dichiarati. Tu vedi l'avanzamento, il sistema fa il lavoro di coordinamento.

## Come si usa
- Apri **Projects** dal dock e crea un progetto scegliendo un blueprint (website-vetrina, ecommerce-base, automazione-workflow, aos-app-development).
- Ogni fase mostra deliverable e criteri di passaggio: quando sono soddisfatti, la fase successiva si attiva.
- Le card generate compaiono nel Kanban: puoi seguirle o intervenire da lì.
- I progetti bloccati vengono segnalati dal Guardian.

## Per gli agenti
Sono esposti 5 tool per l'orchestrazione autonoma (creazione progetti, avanzamento fasi, valutazione gate). Non creare card Kanban a mano per un progetto: passa dai tool del Project Manager.
