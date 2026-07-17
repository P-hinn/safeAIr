# safAIr

Plattform, um AI-Anwendungsfälle **einfacher und sicherer** umzusetzen: PII-Erkennung & Anonymisierung, Guardrails, Content-Moderation und Red Teaming — hinter einer einheitlichen Oberfläche und API.

## Architektur

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────────────────┐
│  apps/web        │      │ services/gateway │      │ services/pii-service     │
│  Nuxt 4 (UI)     │ ───► │ Fastify (Node)   │ ───► │ FastAPI + Presidio       │
│  :3000           │      │ :8080            │      ├──────────────────────────┤
└─────────────────┘      └──────────────────┘      │ services/guardrails-     │
                                                    │ service (FastAPI)        │
                                                    └──────────────────────────┘
```

| Komponente | Stack | Port | Zweck |
|---|---|---|---|
| `apps/web` | Nuxt 4, TypeScript | 3000 | Oberfläche / Dashboard |
| `services/gateway` | Node 22, Fastify | 8080 | API-Gateway/BFF, Routing, Health-Aggregation |
| `services/pii-service` | Python, FastAPI | 8001 | PII: Presidio ✅, Scrubadub ✅, GCP DLP 🔌, AWS Comprehend 🔌 |
| `services/guardrails-service` | Python, FastAPI | 8002 | Guardrails: Heuristik ✅, LLM Guard 🔌, Guardrails AI 🔌, NeMo 🔌, OpenAI Guardrails 🔌, Lakera 🔌 |
| `services/moderation-service` | Python, FastAPI | 8003 | Moderation: Llama Guard 3 via Ollama 🔌 |
| `services/redteam-service` | Python, FastAPI + Node | 8004 | Red Teaming: Promptfoo ✅, Garak 🔌 |

Alle Services sind Multi-Engine: pro Request wählbar (`engine`-Parameter), Status via `GET /v1/engines`.
Vollständige Tool-Matrix inkl. Aktivierung: [docs/tools.md](docs/tools.md)

## Quickstart (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- UI: http://localhost:3000
- Gateway: http://localhost:8080/health

## Lokale Entwicklung ohne Docker

```bash
# Frontend
cd apps/web && npm install && npm run dev

# Gateway
cd services/gateway && npm install && npm run dev

# PII-Service
cd services/pii-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm && python -m spacy download de_core_news_sm
uvicorn app.main:app --reload --port 8001

# Guardrails-Service
cd services/guardrails-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

## API-Überblick (über das Gateway)

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/health` | Aggregierter Status aller Services |
| GET | `/api/pii/v1/engines` | Verfügbare PII-Engines + Status |
| POST | `/api/pii/v1/analyze` | PII erkennen (`engine`: presidio, scrubadub, gcp-dlp, aws-comprehend) |
| POST | `/api/pii/v1/anonymize` | PII anonymisieren |
| GET | `/api/guardrails/v1/engines` | Verfügbare Guardrail-Engines + Status |
| POST | `/api/guardrails/v1/scan/prompt` | Eingabe-Prompt prüfen (`engine` wählbar) |
| POST | `/api/guardrails/v1/scan/output` | LLM-Antwort prüfen |
| POST | `/api/moderation/v1/moderate` | Content-Moderation (Llama Guard) |
| GET | `/api/redteam/v1/tools` | Red-Teaming-Tools + Status |
| POST | `/api/redteam/v1/scans` | Promptfoo-/Garak-Lauf starten |

Details: [docs/architecture.md](docs/architecture.md)
