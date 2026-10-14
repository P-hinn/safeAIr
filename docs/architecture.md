# safAIr – Architektur

## Prinzipien

- **Ein Service pro Safety-Domäne:** PII, Guardrails, Moderation, Red Teaming und Orchestrierung sind eigenständige Services mit eigener Deploy-Einheit.
- **Bewusst gemischter Stack:** Python für alles, was auf AI-Safety-Libraries aufsetzt (Presidio, LLM Guard, NeMo, …), Node.js/TypeScript für Gateway und Frontend.
- **Gateway als einziger Eintrittspunkt:** Das Frontend spricht ausschließlich mit dem Gateway. Die internen Services haben keine eigene Authentifizierung und sind nur im internen Netz erreichbar (in Docker Compose zusätzlich auf `127.0.0.1` gemappt, nur für lokales Debugging).
- **Versionierte Service-APIs** (`/v1/...`), damit Services unabhängig weiterentwickelt werden können.
- **Engine-Abstraktion:** Jede Analyse-Domäne definiert ein gemeinsames Interface. Konkrete Engines werden per Request (`engine`) gewählt und melden über `GET /v1/engines` ihren Status (`ready`, `not_installed`, `not_configured`).

## Request-Fluss

```text
Browser ──► Web-App (Nuxt, Login + Session-Cookie)
   │
   └──────► Gateway (Fastify)
              ├─ Session prüfen (HMAC-signiertes Cookie, geteilt mit der Web-App)
              ├─ /api/<service>/*  ──► Reverse Proxy zum jeweiligen Service
              ├─ /health           ──► aggregierter Health Check
              ├─ /monitoring       ──► Snapshot aus periodischen Checks
              └─ /docs, /openapi.json
```

## Komponenten

### apps/web (Nuxt 4)

- Seiten: Management-Dashboard, Prozesslandkarte, Monitoring, Policies, AI-Tool-Katalog, Playground, PII, Guardrails, Moderation, Red Teaming.
- **Prozesslandkarte:** Prozesse nach Bereichen und Ebenen (Vue Flow + ELK-Layout), BPMN-2.0-Editor auf Basis von bpmn-js mit eigenem Moddle-Schema für Governance-Metadaten (AI-Einsatz, Datenflüsse, Risiken). Import/Export von BPMN-XML, Persistenz im `localStorage` des Browsers.
- **Zugangsschutz:** Server-Middleware leitet ohne gültige Session auf `/login` um. Login mit Rate Limit pro Client, Session als HMAC-signiertes Cookie (`SESSION_SECRET`), `HttpOnly`, `SameSite=Strict`.
- Spricht das Gateway über `NUXT_PUBLIC_API_BASE` an.

### services/gateway (Fastify)

- Reverse Proxy: `/api/pii`, `/api/guardrails`, `/api/moderation`, `/api/redteam`, `/api/orchestrator` → jeweiliger Service (Registrierung in [`src/config.ts`](../services/gateway/src/config.ts)).
- Prüft dieselbe Session wie die Web-App; ohne konfigurierten Zugangsschutz antwortet es mit `503`.
- `/health` aggregiert die Health-Endpoints aller Services, `/ready` ist ein minimaler, öffentlicher Check für die Deployment-Plattform.
- `/monitoring` liefert Verfügbarkeit, Latenzen, Verlauf und das AI-Inventar (Engines, Provider, Tools) aus periodischen Checks.
- OpenAPI-3-Spezifikation und Swagger UI unter `/openapi.json` und `/docs`.

### services/pii-service (FastAPI)

- `POST /v1/analyze` erkennt PII (Name, E-Mail, Telefon, IBAN, …), `POST /v1/anonymize` ersetzt sie durch Platzhalter.
- Engines: `presidio` (Default, spaCy-Modelle für de/en im Image), `scrubadub`, `gcp-dlp`, `aws-comprehend`.

### services/guardrails-service (FastAPI)

- `POST /v1/scan/prompt` prüft Eingaben (Prompt Injection, Jailbreaks, Secrets, …), `POST /v1/scan/output` prüft Modellantworten.
- Engines: `heuristic` (Default, regelbasiert, ohne Abhängigkeiten), `llm-guard`, `nemo-guardrails`, `lakera`; `guardrails-ai` und `openai-guardrails` sind als Platzhalter vorbereitet.

### services/moderation-service (FastAPI)

- `POST /v1/moderate` klassifiziert Inhalte mit Llama Guard 3 über eine Ollama-Instanz (`OLLAMA_URL`) nach den MLCommons-Gefahrenkategorien.

### services/redteam-service (FastAPI + Node.js)

- Startet Promptfoo- und Garak-Läufe als Hintergrundprozesse und stellt Status und Log bereit.
- Es sind ausschließlich vordefinierte Presets erlaubt (`GET /v1/presets`). Freie CLI-Argumente würden über Tool-Features wie Promptfoo-`exec:`-Provider beliebige Befehle ermöglichen.
- Begrenzung auf zwei parallele Läufe, ältere Jobs werden automatisch aufgeräumt.

### services/orchestrator (FastAPI + SQLite)

- **Policies:** Konfiguration der Pipeline-Schritte, gespeichert in SQLite (`DATA_DIR`). Eingebaute Policies (Standard, Strikt, …) sind schreibgeschützt.
- **Safety-Pipeline** (`POST /v1/chat`):

  ```text
  Verlauf prüfen → PII (Prompt) → Guardrails (Prompt) → Moderation (Prompt)
        → LLM (Ollama · OpenAI · Anthropic)
        → Guardrails (Output) → Moderation (Output) → PII (Output)
  ```

  Jeder Schritt kann pro Policy aktiviert, auf *warnen* oder *blockieren* gestellt werden. `fail_closed` legt fest, ob ein ausgefallener Service die Anfrage blockiert. Die Antwort enthält einen vollständigen Trace mit Status und Dauer pro Schritt.
- **Prozessgenerierung:** `POST /v1/processes/generate` erzeugt aus einer Beschreibung per OpenAI Structured Output einen BPMN-Entwurf, validiert den Graphen und lässt ihn bei Fehlern einmal reparieren. `POST /v1/audio/transcriptions` transkribiert Spracheingaben dafür.

## Konventionen

- Jeder Service: `GET /health` → `{ "status": "ok", "service": "<name>" }`.
- Fehlerformat der Services: `{ "detail": { "error": { "code": string, "message": string } } }`.
- Neue Services werden in `docker-compose.yml`, `.do/app.yaml`, im Gateway (`src/config.ts`) und in der OpenAPI-Spezifikation (`src/openapi.ts`) registriert.

## Bekannte Grenzen

- Der Zugangsschutz ist ein gemeinsames Passwort ohne Benutzerverwaltung. Sessions sind zustandslos und laufen nach 12 Stunden ab, Logout löscht nur das Cookie.
- Red-Team-Jobs und Monitoring-Verlauf liegen im Speicher und gehen bei einem Neustart verloren.
- SQLite ist auf ephemeren Dateisystemen (z. B. App Platform) nicht persistent und müsste in Produktion durch eine verwaltete Datenbank ersetzt werden.
