# Image Studio Skill

Use the `agentic-image` CLI to generate AI images from text prompts. Supports 16 providers across OpenAI, Google, Replicate, Stability AI, Vast.ai, and stock photo APIs. All generated images are saved to the gallery and visible at `/image-studio` in the dashboard.

---

## Quick reference

```bash
# Generate an image with the default provider
agentic-image generate "a robot mechanic in a dim garage, cinematic lighting"

# Choose a specific provider
agentic-image generate "logo for a coffee shop" --model openai-dalle3

# Pick aspect ratio (provider must support it)
agentic-image generate "wide landscape mountain valley" --aspect 16:9

# Save the generated PNG to a local file too
agentic-image generate "cat astronaut" --out /tmp/cat.png

# Add a negative prompt
agentic-image generate "portrait of a woman" --negative "blurry, low quality"

# Don't save to gallery (one-off)
agentic-image generate "test image" --no-save

# Browse the gallery
agentic-image list
agentic-image list --limit 20 --provider openai-dalle3
agentic-image list --json | jq '.items[].prompt'

# Download a specific image
agentic-image show <id> --out /tmp/img.png

# Models & defaults
agentic-image models                            # list providers + which is active + availability
agentic-image set-model replicate-flux-schnell  # change system default

# Delete an image from gallery
agentic-image delete <id>

# Gallery stats
agentic-image stats
```

---

## Provider catalog

| Provider id                  | Family    | Cost      | Speed   | Quality   | Notes                                  |
|------------------------------|-----------|-----------|---------|-----------|----------------------------------------|
| `openai-gpt-image-mini`      | OpenAI    | $0.011    | fast    | ok        | Default — cheap iterations             |
| `openai-gpt-image-low`       | OpenAI    | $0.042    | medium  | good      | Medium quality                         |
| `openai-gpt-image-medium`    | OpenAI    | $0.084    | medium  | excellent | High quality production                |
| `openai-gpt-image-high`      | OpenAI    | $0.167    | slow    | excellent | Max quality + large size               |
| `openai-dalle3`              | OpenAI    | $0.04     | medium  | excellent | DALL-E 3 standard                      |
| `openai-dalle3-hd`           | OpenAI    | $0.08     | slow    | excellent | DALL-E 3 HD                            |
| `evolink-imagen`             | Google    | $0.04     | medium  | excellent | Gemini Imagen 2.5 via EvoLink          |
| `gemini-imagen`              | Google    | $0.04     | medium  | excellent | Direct Google Imagen 3 API             |
| `replicate-flux-schnell`     | Replicate | $0.003    | fast    | good      | Best $/img, fast iteration             |
| `replicate-flux-dev`         | Replicate | $0.03     | medium  | excellent | High quality FLUX                      |
| `replicate-sdxl`             | Replicate | $0.0025   | fast    | good      | Cheapest                               |
| `stability-sd3`              | Stability | $0.065    | medium  | excellent | SD3 Large official API                 |
| `stability-core`             | Stability | $0.03     | fast    | good      | Fast Stability Core                    |
| `vast-qwen-image`            | Vast.ai   | ~$0.01    | medium  | excellent | Self-hosted GPU endpoint               |
| `pexels`                     | Stock     | free      | fast    | excellent | Search stock photos (not generation)   |
| `unsplash`                   | Stock     | free      | fast    | excellent | Search Unsplash                        |

## Aspect ratios

`1:1` (square) · `16:9` (landscape/cinematic) · `9:16` (portrait/story) · `4:3` (standard) · `3:4` (vertical) · `21:9` (ultrawide cinema, FLUX/Stability only)

If the provider doesn't support the requested aspect, it falls back to the closest valid size.

---

## When to choose what

- **Quick test / iteration** → `replicate-flux-schnell` or `openai-gpt-image-mini` (cheap + fast)
- **Final hero image, photorealistic** → `openai-gpt-image-high` or `stability-sd3`
- **Artistic / stylized** → `openai-dalle3-hd` or `replicate-flux-dev`
- **Stock photo (no original needed)** → `pexels` or `unsplash` (free)
- **Need specific aspect like 21:9** → `replicate-flux-*` or `stability-*`
- **Want exact prompt control + negative** → `stability-*` (full negative prompt support)

---

## Key management

If a provider says `no key` in `agentic-image models`, add the key to the vault:

```bash
agentic-vault set <provider-id> <key>
# e.g.
agentic-vault set openai sk-proj-...
agentic-vault set replicate r8_...
agentic-vault set stability sk-stab-...
agentic-vault set pexels <pexels-api-key>
```

The keys are persisted with 0600 permissions in `~/.agentic-os/vault/vault.json`.

---

## REST API (for direct integration without CLI)

- `POST /api/image-gen/generate`  body `{prompt, provider?, aspectRatio?, size?, negativePrompt?, save?}` → returns `{ok, provider, galleryItem, dataUrl?}`
- `GET  /api/image-gen/gallery?limit=60&provider=xxx&stats=1` → `{items, stats, count}`
- `GET  /api/image-gen/gallery/[id]` → full metadata
- `DELETE /api/image-gen/gallery/[id]`
- `GET  /api/image-gen/providers` → `{active, providers, availability}`
- `POST /api/image-gen/providers` body `{provider}` → set system default

All generated images served at `/gallery/<filename>` (symlinked from `~/.agentic-os/gallery/`).

---

## Examples for agents

**"Genera l'icona di copertina di un articolo"**
```bash
agentic-image generate "abstract digital tech background, gold accents, dark aubergine, premium feel" \
  --model openai-dalle3 --aspect 16:9 --out /tmp/cover.png
```

**"Trova una foto stock di un caffè per il blog"**
```bash
agentic-image generate "italian espresso coffee on wood table, warm light" --model pexels --out /tmp/coffee.jpg
```

**"Crea 3 varianti dello stesso concept"**
```bash
for i in 1 2 3; do
  agentic-image generate "futuristic dashboard, holographic UI, dark theme" \
    --model replicate-flux-schnell --aspect 16:9
done
```
