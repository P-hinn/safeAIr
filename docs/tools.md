# safAIr – Tool-Matrix

Status-Legende: ✅ integriert & sofort nutzbar · 🔌 Adapter vorhanden, Aktivierung nötig · 🧩 Platzhalter (Engine registriert, Anbindung offen) · ◌ Roadmap · 📚 Doku/Referenz

## PII-Erkennung & Anonymisierung (`services/pii-service`, Engine-Parameter `engine`)

| Tool | Engine-Name | Status | Aktivierung |
|---|---|---|---|
| [Microsoft Presidio](https://microsoft.github.io/presidio/) | `presidio` | ✅ Default | – (de/en im Image) |
| [Scrubadub](https://github.com/LeapBeyond/scrubadub) | `scrubadub` | ✅ | – (en) |
| [Google Cloud DLP](https://cloud.google.com/security/products/dlp) | `gcp-dlp` | 🔌 | `google-cloud-dlp` in requirements.txt + `GCP_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` |
| [AWS Comprehend PII](https://aws.amazon.com/comprehend/) | `aws-comprehend` | 🔌 | `boto3` in requirements.txt + `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| [pii-anon](https://github.com/subhash-holla/pii-anon) | – | ◌ | Kandidat, evaluieren |
| [Microsoft Purview](https://www.microsoft.com/en-us/security/business/microsoft-purview) | – | ◌ | Enterprise-Governance-Suite, kein Runtime-Tool |
| [John Snow Labs Healthcare NLP](https://www.johnsnowlabs.com/) | – | ◌ | Kommerzielle Lizenz erforderlich |

## Guardrails (`services/guardrails-service`, Engine-Parameter `engine`)

| Tool | Engine-Name | Status | Aktivierung |
|---|---|---|---|
| safAIr Heuristik | `heuristic` | ✅ Default | – |
| [LLM Guard](https://github.com/protectai/llm-guard) | `llm-guard` | 🔌 | `llm-guard` in requirements.txt (lädt ML-Modelle) |
| [Guardrails AI](https://github.com/guardrails-ai/guardrails) | `guardrails-ai` | 🧩 | Guard mit Hub-Validatoren noch anzubinden |
| [NeMo Guardrails](https://docs.nvidia.com/nemo/guardrails/) | `nemo-guardrails` | 🔌 | `nemoguardrails` + `NEMO_CONFIG_PATH` (Colang-Config) + LLM-Key |
| [OpenAI Guardrails](https://github.com/openai/openai-guardrails-python) | `openai-guardrails` | 🧩 | Noch anzubinden; braucht Paket + `OPENAI_API_KEY`, ⚠️ Namespace-Konflikt mit guardrails-ai |
| [Lakera Guard](https://www.lakera.ai/) | `lakera` | 🔌 | `LAKERA_GUARD_API_KEY` in .env |

## Content-Moderation (`services/moderation-service`)

| Tool | Status | Aktivierung |
|---|---|---|
| [Llama Guard 3](https://github.com/meta-llama/PurpleLlama) via Ollama | 🔌 | `ollama pull llama-guard3`, dann `OLLAMA_URL=http://host.docker.internal:11434` |

## Testing & Red Teaming (`services/redteam-service`)

| Tool | Status | Aktivierung |
|---|---|---|
| [Promptfoo](https://github.com/promptfoo/promptfoo) | ✅ im Image | Provider-Keys (`OPENAI_API_KEY`, …) in .env; Job via `POST /api/redteam/v1/scans` |
| [Garak](https://github.com/NVIDIA/garak) | 🔌 | `garak` in requirements.txt aktivieren (großes Image) |

Scans werden ausschließlich aus vordefinierten Presets gestartet (`GET /api/redteam/v1/presets`), freie CLI-Argumente sind aus Sicherheitsgründen nicht erlaubt.

| Preset | Tool | Parameter |
|---|---|---|
| `promptfoo-version` | Promptfoo | – |
| `promptfoo-redteam-plugins` | Promptfoo | – |
| `garak-version` | Garak | – |
| `garak-list-probes` | Garak | – |
| `garak-probe` | Garak | `model` (OpenAI-Modell), `probe` (z. B. `dan`) |

Beispiel-Scan (mit Session-Cookie aus dem Browser-Login):

```bash
curl -X POST http://localhost:8080/api/redteam/v1/scans \
  -H 'Content-Type: application/json' \
  -b 'safair_session=…' \
  -d '{"preset": "garak-probe", "model": "gpt-4o-mini", "probe": "dan"}'
```

## LLM-Provider (`services/orchestrator`)

| Provider | Status | Aktivierung |
|---|---|---|
| [Ollama](https://ollama.com/) | 🔌 | `OLLAMA_URL`; Standard-Policies nutzen `llama3.2` |
| [OpenAI](https://platform.openai.com/) | 🔌 | `OPENAI_API_KEY`; zusätzlich Prozessgenerierung (`OPENAI_PROCESS_MODEL`) und Transkription (`OPENAI_TRANSCRIPTION_MODEL`) |
| [Anthropic](https://docs.anthropic.com/) | 🔌 | `ANTHROPIC_API_KEY` |

## Kommerziell/Managed (Roadmap)

| Tool | Einordnung |
|---|---|
| [Protecto](https://www.protecto.ai/) | ◌ Adapter geplant (API-Zugang erforderlich) |

## Hintergrund-Artikel 📚

- [Vergleich Open-Source-Tools für Sensitive Data Discovery](https://www.bytebase.com/blog/top-open-source-sensitive-data-discovery-tools/)
- [Presidio-Praxisguide 2026](https://explainx.ai/blog/microsoft-presidio-pii-detection-anonymization-guide-2026)
- [Überblick AI-Guardrails-Tools](https://christianmendieta.ca/ai-guardrails-free-tools-to-secure-llm-applications-and-ai-agentic-workflows/)
- [NeMo Guardrails Paper](https://arxiv.org/abs/2310.10501)
