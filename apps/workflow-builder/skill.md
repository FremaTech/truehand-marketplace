# Workflow Builder

App AOS che permette di costruire ed eseguire pipeline multi-step per la produzione di contenuti (video, articoli, immagini, audio).

## Uso per agenti

Gli agenti possono interagire con Workflow Builder tramite la CLI `agentic-wfb` o tramite API HTTP `/api/workflow-builder/*`.

### Lista i workflow esistenti
```
agentic-wfb list
```

### Esegui un workflow per ID
```
agentic-wfb run <flow-id> --input '{"topic":"stoicismo","duration":60}'
```

### Crea un workflow da template
```
agentic-wfb create --template video-shorts --name "Stoic Shorts Daily"
```

## Templates predefiniti

- **video-shorts** — Script (Haiku) → Voiceover (Piper/ElevenLabs) → Immagini (best-image-gen) → Montaggio (FFmpeg) → Pubblicazione (Blotato)
- **article-pipeline** — Brief → Research (WebSearch) → Draft (Sonnet) → SEO meta → Pubblicazione (WordPress)
- **podcast-episode** — Outline → Script → Voiceover → Music bed → Mix → RSS

## Nodi disponibili

| Tipo | Input | Output | Implementazione |
|------|-------|--------|-----------------|
| `script` | topic, duration, tone | text | Claude Haiku/Sonnet |
| `voiceover` | text, voice, lang | audio file path | Piper TTS / ElevenLabs |
| `image` | prompt, aspect | image file path | best-image-generation skill |
| `image-batch` | prompts[] | image[] paths | batched best-image-gen |
| `video-merge` | audio, images[], duration | mp4 path | FFmpeg |
| `subtitle` | audio | srt path | Whisper |
| `publish` | mp4, title, desc | url | Blotato API |
| `webhook` | url, payload | response | HTTP call |
| `shell` | command | stdout | bash exec |
| `branch` | condition | path | if/else routing |

## Stato runs

Output e log salvati in `~/.agentic-os/workflow-builder/runs/<runId>/`:
- `manifest.json` — flusso eseguito
- `step-<n>-<nodeId>.json` — output di ogni nodo
- `final.json` — output finale aggregato
- `errors.log`

## Note

- I flussi sono file JSON in `~/.agentic-os/workflow-builder/flows/`
- Editor visuale: http://localhost:3000/workflow-builder
- I run sono asincroni con SSE updates a `/api/workflow-builder/runs/<id>/stream`
