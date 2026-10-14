"""safAIr Red-Teaming-Service: Wrapper um Promptfoo und Garak.

- GET  /v1/tools           Verfügbarkeit der Tools
- GET  /v1/presets         Erlaubte Scan-Presets
- POST /v1/scans           Scan-Job aus einem Preset starten, z. B.
      {"preset": "promptfoo-redteam-plugins"}
      {"preset": "garak-probe", "model": "gpt-4o-mini", "probe": "dan"}
- GET  /v1/scans           Jobliste
- GET  /v1/scans/{id}      Status + Log-Ausschnitt
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .jobs import PRESETS, ScanLimitError, get_job, job_log_tail, list_jobs, start_job, tool_available

SERVICE_NAME = "redteam-service"

app = FastAPI(title="safAIr Red Teaming Service", version="0.1.0")


class ScanRequest(BaseModel):
    preset: str = Field(min_length=1, max_length=64)
    model: str | None = Field(default=None, max_length=80)
    probe: str | None = Field(default=None, max_length=80)


def _job_view(job, log_lines: int = 0) -> dict:
    view = {
        "id": job.id,
        "tool": job.tool,
        "preset": job.preset,
        "args": job.args,
        "status": job.status,
        "started_at": job.started_at,
    }
    if log_lines:
        view["log_tail"] = job_log_tail(job, log_lines)
    return view


@app.get("/health")
def health():
    return {"status": "ok", "service": SERVICE_NAME}


@app.get("/v1/tools")
def tools():
    return {
        "tools": [
            {
                "name": "promptfoo",
                "title": "Promptfoo",
                "status": "ready" if tool_available("promptfoo") else "not_installed",
                "detail": "LLM-Eval & Red Teaming (im Image vorinstalliert). Provider-Keys via .env.",
                "docs_url": "https://github.com/promptfoo/promptfoo",
            },
            {
                "name": "garak",
                "title": "Garak (NVIDIA)",
                "status": "ready" if tool_available("garak") else "not_installed",
                "detail": "LLM-Schwachstellen-Scanner. In requirements.txt 'garak' aktivieren (großes Image).",
                "docs_url": "https://github.com/NVIDIA/garak",
            },
        ]
    }


@app.get("/v1/presets")
def presets():
    return {
        "presets": [
            {"name": name, "tool": p.tool, "title": p.title, "needs_target": p.needs_target}
            for name, p in PRESETS.items()
        ]
    }


@app.post("/v1/scans", status_code=201)
def create_scan(req: ScanRequest):
    try:
        job = start_job(req.preset, req.model, req.probe)
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": {"code": "invalid_preset", "message": str(e)}})
    except ScanLimitError as e:
        raise HTTPException(status_code=429, detail={"error": {"code": "too_many_scans", "message": str(e)}})
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail={"error": {"code": "tool_unavailable", "message": str(e)}})
    return _job_view(job)


@app.get("/v1/scans")
def scans():
    return {"scans": [_job_view(j) for j in list_jobs()]}


@app.get("/v1/scans/{job_id}")
def scan_detail(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": f"Job {job_id} unbekannt"}})
    return _job_view(job, log_lines=100)
