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
| `services/pii-service` | Python 3.12, FastAPI, Microsoft Presidio | 8001 | PII-Erkennung & Anonymisierung (de/en) |
| `services/guardrails-service` | Python 3.12, FastAPI (LLM Guard optional) | 8002 | Prompt-/Output-Scanning |

Geplante Services (Stubs folgen): Moderation (Llama Guard), Red Teaming (Promptfoo/Garak).

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
| POST | `/api/pii/v1/analyze` | PII im Text erkennen |
| POST | `/api/pii/v1/anonymize` | PII im Text anonymisieren |
| POST | `/api/guardrails/v1/scan/prompt` | Eingabe-Prompt prüfen |
| POST | `/api/guardrails/v1/scan/output` | LLM-Antwort prüfen |

Details: [docs/architecture.md](docs/architecture.md)
