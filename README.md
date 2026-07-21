<div align="center">

# safeAIr

**Eine zentrale Plattform für sichere, nachvollziehbare und datenschutzfreundliche AI-Workflows.**

[![Production](https://img.shields.io/badge/Production-live-22c55e?style=flat-square)](https://safair.philippniestroj.com/)
[![API Docs](https://img.shields.io/badge/API%20Docs-Swagger-85EA2D?style=flat-square&logo=swagger&logoColor=white)](https://safair.philippniestroj.com/docs/)
[![Deployment](https://img.shields.io/badge/Deployment-DigitalOcean-0080FF?style=flat-square&logo=digitalocean&logoColor=white)](.do/app.yaml)
[![Docker](https://img.shields.io/badge/Local-Docker%20Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](#lokal-starten)

[Live-Anwendung](https://safair.philippniestroj.com/) · [Swagger-Dokumentation](https://safair.philippniestroj.com/docs/) · [Architektur](docs/architecture.md) · [Tool-Matrix](docs/tools.md)

</div>

safeAIr bündelt PII-Erkennung und Anonymisierung, Guardrails, Content-Moderation, Red Teaming und die Orchestrierung von AI-Anfragen hinter einer einheitlichen Weboberfläche und API. Sicherheitsrichtlinien lassen sich zentral konfigurieren, Engines pro Request auswählen und Services über das integrierte Monitoring beobachten.

## Deployment

| Umgebung | Status | Anwendung | API-Dokumentation |
|---|---|---|---|
| Produktion | 🟢 Live | [safair.philippniestroj.com](https://safair.philippniestroj.com/) | [Swagger UI](https://safair.philippniestroj.com/docs/) |
| Lokal | ⚪ On demand | [localhost:3000](http://localhost:3000) | [localhost:8080/docs](http://localhost:8080/docs) |

Die Produktionsumgebung ist durch den zentralen safeAIr-Login geschützt. Anwendung, API und Swagger UI sind deshalb erst nach erfolgreicher Anmeldung nutzbar.

Deployments erfolgen automatisch aus dem Branch `main` über die DigitalOcean App Platform. Die Plattform prüft Web-App, Gateway und alle internen Services mit separaten Health Checks. Die vollständige Infrastrukturdefinition liegt unter [`.do/app.yaml`](.do/app.yaml); Secrets und Provider-Schlüssel werden ausschließlich als verschlüsselte Runtime-Variablen konfiguriert.

## Funktionsumfang

- **PII & Datenschutz:** Personenbezogene Daten mit Presidio oder Scrubadub erkennen und anonymisieren; optionale Adapter für Google Cloud DLP und AWS Comprehend.
- **Guardrails:** Prompts und Modellantworten auf Injection-Versuche und Richtlinienverstöße prüfen; erweiterbar um LLM Guard, Guardrails AI, NeMo und Lakera Guard.
- **Content-Moderation:** Inhalte mit Llama Guard klassifizieren und sicherheitsrelevante Kategorien auswerten.
- **Red Teaming:** Sicherheitsprüfungen mit Promptfoo starten und verwalten; Garak kann optional eingebunden werden.
- **AI-Orchestrierung:** Provider, Modelle und Policies verwalten sowie PII-, Guardrail- und Moderationsschritte zu einer sicheren Pipeline kombinieren.
- **Monitoring:** Verfügbarkeit, Latenzen, Endpoint-Historie und AI-Inventar zentral überwachen.

## Architektur

```text
┌──────────────────────────┐
│ Web-App                  │
│ Nuxt 4 · Vue · TypeScript│
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ API-Gateway              │
│ Fastify · Auth · OpenAPI │
└────────────┬─────────────┘
             │
     ┌───────┼────────┬───────────┬────────────┐
     ▼       ▼        ▼           ▼            ▼
┌─────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐ ┌────────────┐
│ PII     │ │ Guard- │ │Moderation│ │Red Team │ │Orchestrator│
│ Service │ │ rails  │ │ Service  │ │ Service │ │ & Policies │
└─────────┘ └────────┘ └──────────┘ └─────────┘ └────────────┘
```

| Komponente | Stack | Port | Aufgabe |
|---|---|---:|---|
| `apps/web` | Nuxt 4, Vue, TypeScript | 3000 | Weboberfläche und Dashboard |
| `services/gateway` | Node.js 22, Fastify | 8080 | API-Gateway, Authentifizierung, Routing, OpenAPI und Monitoring |
| `services/pii-service` | Python, FastAPI, Presidio | 8001 | PII-Erkennung und Anonymisierung |
| `services/guardrails-service` | Python, FastAPI | 8002 | Prüfung von Prompts und Modellantworten |
| `services/moderation-service` | Python, FastAPI | 8003 | Content-Moderation über Llama Guard |
| `services/redteam-service` | Python, FastAPI, Node.js | 8004 | Red-Teaming-Läufe mit Promptfoo oder Garak |
| `services/orchestrator` | Python, FastAPI | 8005 | Provider, Policies und sichere AI-Pipelines |

Weitere technische Details enthält die [Architekturdokumentation](docs/architecture.md). Eine Übersicht aller Engines und ihrer Aktivierung steht in der [Tool-Matrix](docs/tools.md).

## Lokal starten

### Voraussetzungen

- Docker mit Docker Compose
- eine aus [`.env.example`](.env.example) erstellte `.env`-Datei

### Gesamten Stack starten

```bash
cp .env.example .env
docker compose up --build
```

Danach stehen folgende Endpunkte zur Verfügung:

| Dienst | URL |
|---|---|
| Weboberfläche | <http://localhost:3000> |
| Gateway Health | <http://localhost:8080/health> |
| Swagger UI | <http://localhost:8080/docs> |
| OpenAPI JSON | <http://localhost:8080/openapi.json> |

> [!IMPORTANT]
> Setze in `.env` ein `SITE_PASSWORD` mit mindestens zwölf Zeichen. Optionale Provider und Engines benötigen die jeweiligen API-Schlüssel beziehungsweise lokalen Modelle.

### Entwicklung ohne Docker

```bash
# Frontend
cd apps/web
npm install
npm run dev

# Gateway
cd services/gateway
npm install
npm run dev

# PII-Service
cd services/pii-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python -m spacy download de_core_news_sm
uvicorn app.main:app --reload --port 8001

# Guardrails-Service
cd services/guardrails-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

Die weiteren Python-Services folgen demselben Muster und werden auf den in der [Komponentenübersicht](#architektur) genannten Ports gestartet.

## API

Die API ist über das Gateway erreichbar. Ihre vollständige OpenAPI-3-Spezifikation steht interaktiv in der [Swagger UI](https://safair.philippniestroj.com/docs/) sowie maschinenlesbar als [OpenAPI JSON](https://safair.philippniestroj.com/openapi.json) zur Verfügung. In Produktion verwenden Weboberfläche und API dieselbe signierte Session.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/health` | Aggregierter Status aller Services |
| `GET` | `/monitoring` | Verfügbarkeit, Latenzen und AI-Inventar |
| `GET` | `/api/pii/v1/engines` | Verfügbare PII-Engines und Status |
| `POST` | `/api/pii/v1/analyze` | Personenbezogene Daten erkennen |
| `POST` | `/api/pii/v1/anonymize` | Personenbezogene Daten anonymisieren |
| `GET` | `/api/guardrails/v1/engines` | Verfügbare Guardrail-Engines und Status |
| `POST` | `/api/guardrails/v1/scan/prompt` | Eingabe-Prompt prüfen |
| `POST` | `/api/guardrails/v1/scan/output` | Modellantwort prüfen |
| `POST` | `/api/moderation/v1/moderate` | Inhalt moderieren |
| `GET` | `/api/redteam/v1/tools` | Red-Teaming-Tools und Status |
| `POST` | `/api/redteam/v1/scans` | Red-Team-Scan starten |
| `GET` | `/api/orchestrator/v1/providers` | Provider und Modelle auflisten |
| `GET` | `/api/orchestrator/v1/policies` | Sicherheitsrichtlinien auflisten |
| `POST` | `/api/orchestrator/v1/chat` | Sichere AI-Pipeline ausführen |

Request-Schemas, Response-Beispiele und Fehlercodes sind direkt in der Swagger-Dokumentation beschrieben.

## Engines und Integrationen

Alle Analyse-Services unterstützen mehrere Engines. Die gewünschte Implementierung wird pro Request über den Parameter `engine` ausgewählt. `GET /v1/engines` liefert jeweils die verfügbaren Engines und ihren aktuellen Konfigurationsstatus.

Optionale Integrationen bleiben deaktiviert, bis ihre Abhängigkeiten und Zugangsdaten konfiguriert wurden. Dadurch läuft der lokale Basis-Stack ohne externe Cloud-Credentials.
