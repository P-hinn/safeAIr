"""safAIr Red-Teaming-Service: Wrapper um Promptfoo und Garak.

- GET  /v1/tools           Verfügbarkeit der Tools
- POST /v1/scans           Scan-Job starten, z. B.
      {"tool": "promptfoo", "args": ["redteam", "run", "--config", "promptfooconfig.yaml"]}
      {"tool": "garak", "args": ["--model_type", "openai", "--model_name", "gpt-4o-mini", "--probes", "dan"]}
- GET  /v1/scans           Jobliste
- GET  /v1/scans/{id}      Status + Log-Ausschnitt
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .jobs import get_job, job_log_tail, list_jobs, start_job, tool_available

SERVICE_NAME = "redteam-service"

app = FastAPI(title="safAIr Red Teaming Service", version="0.1.0")


class ScanRequest(BaseModel):
    tool: str = Field(pattern="^(promptfoo|garak)$")
    args: list[str] = Field(default_factory=list, max_length=32)


def _job_view(job, log_lines: int = 0) -> dict:
    view = {
        "id": job.id,
        "tool": job.tool,
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


@app.post("/v1/scans", status_code=201)
def create_scan(req: ScanRequest):
    try:
        job = start_job(req.tool, req.args)
    except (ValueError, RuntimeError) as e:
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
