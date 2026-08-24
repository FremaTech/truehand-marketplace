# TrueHand Marketplace

Il catalogo ufficiale delle app installabili per **TrueHand** (Agentic OS).

## Struttura

- `registry.json` — l'indice che l'app Marketplace di TrueHand consulta
- `apps/<id>/` — il sorgente di ogni app (manifest.json + entry + ui/ + skill.md)
- `dist/<id>.tar.gz` — il pacchetto installabile, generato da `apps/<id>/`

## Come funziona l'installazione

L'app di sistema **Marketplace** di TrueHand legge `registry.json` (raw da
questo repo), mostra il catalogo e installa il `tar.gz` scelto dentro
`~/.agentic-os/apps/<id>/`. La disinstallazione rimuove la cartella.

## Formato app

Ogni app è una cartella con:

- `manifest.json` — id, nome, versione, categoria, runtime, entry, ui, skill, widgets
- `entry.js` / `entry.sh` — il backend (opzionale)
- `ui/` — interfaccia web (opzionale)
- `skill.md` — la skill che espone l'app agli agenti (opzionale)

## Rigenerare dist e registry

```bash
for a in apps/*/; do id=$(basename "$a"); tar czf dist/"$id".tar.gz -C apps "$id"; done
node genera-registry.mjs
```

## Contribuire

Le app di terze parti sono benvenute: PR con la cartella in `apps/` e una
riga di descrizione. Verranno eseguite in sandbox con livello di fiducia
"terza parte".
