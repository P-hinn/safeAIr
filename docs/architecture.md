# safAIr – Architektur

## Prinzipien

- **Microservices nach Domäne**: Jede Safety-Fähigkeit (PII, Guardrails, Moderation, Red Teaming) ist ein eigener Service mit eigener Deploy-Einheit.
- **Gemischter Stack, bewusst gewählt**: Python für alles, was auf AI-Safety-Libraries aufsetzt (Presidio, LLM Guard, …), Node/TypeScript für Gateway/BFF und Frontend-Tooling.
- **Gateway als einziger Eintrittspunkt**: Das Frontend spricht ausschließlich mit dem Gateway. Services sind untereinander nur im Docker-Netzwerk erreichbar (Ports nach außen nur für lokales Debugging gemappt).
- **Versionierte Service-APIs** (`/v1/...`), damit Services unabhängig weiterentwickelt werden können.

## Komponenten

### apps/web (Nuxt 4)
- Dashboard mit Service-Status, später UI für Anonymisierung, Guardrail-Konfiguration, Testläufe.
- Spricht das Gateway über `NUXT_PUBLIC_API_BASE` an.

### services/gateway (Fastify)
- Reverse Proxy: `/api/pii/*` → PII-Service, `/api/guardrails/*` → Guardrails-Service.
- `/health` aggregiert die Health-Endpoints aller Services.
- Hier später: AuthN/AuthZ, Rate Limiting, Audit-Logging, Request-Pipelines (z. B. „erst PII-Scan, dann LLM-Call").

### services/pii-service (FastAPI + Presidio)
- `POST /v1/analyze` – erkennt PII-Entitäten (Name, E-Mail, Telefon, IBAN, …).
- `POST /v1/anonymize` – ersetzt/maskiert erkannte Entitäten.
- Sprachen über `PII_LANGUAGES` (Standard: `en,de`, spaCy-Modelle im Image enthalten).

### services/guardrails-service (FastAPI)
- `POST /v1/scan/prompt` – prüft User-Eingaben (Prompt Injection, Secrets, …).
- `POST /v1/scan/output` – prüft LLM-Antworten.
- Zwei Engines via `GUARDRAILS_ENGINE`:
  - `heuristic` (Default): leichtgewichtige Regex-/Regel-Checks, sofort lauffähig.
  - `llm-guard`: nutzt [LLM Guard](https://github.com/protectai/llm-guard), erfordert `pip install llm-guard` (lädt ML-Modelle).

## Geplante Services

| Service | Basis | Zweck |
|---|---|---|
| moderation-service | Llama Guard (PurpleLlama) | Content-Moderation |
| redteam-service | Promptfoo / Garak | Automatisiertes Testing & Red Teaming |

Gleiches Muster: FastAPI (bzw. Node bei Promptfoo), `/health`, `/v1/...`, eigenes Dockerfile, Route im Gateway.

## Konventionen

- Jeder Service: `GET /health` → `{ "status": "ok", "service": "<name>" }`.
- Fehlerformat: `{ "error": { "code": string, "message": string } }`.
- Neue Services werden in `docker-compose.yml` und im Gateway (`src/routes.ts`) registriert.
