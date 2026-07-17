"""safAIr Guardrails-Service: Prompt-/Output-Scans mit austauschbaren Engines."""

from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .engines import DEFAULT_ENGINE, get_engine, list_engines

SERVICE_NAME = "guardrails-service"

app = FastAPI(title="safAIr Guardrails Service", version="0.2.0")


class ScanRequest(BaseModel):
    text: str = Field(min_length=1)
    engine: str = DEFAULT_ENGINE


def _resolve_engine(name: str, scope: str):
    try:
        engine = get_engine(name)
    except KeyError as e:
        raise HTTPException(status_code=422, detail={"error": {"code": "unknown_engine", "message": str(e)}})
    info = engine.info()
    if info.status != "ready":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": f"engine_{info.status}", "message": f"{info.title}: {info.detail}"}},
        )
    if scope not in info.scopes:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "scope_unsupported", "message": f"{info.title} unterstützt Scope '{scope}' nicht."}},
        )
    return engine


def _run(fn, text: str):
    try:
        return asdict(fn(text))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail={"error": {"code": "engine_unavailable", "message": str(e)}})
    except Exception as e:  # Upstream-/API-Fehler sauber melden
        raise HTTPException(status_code=502, detail={"error": {"code": "engine_error", "message": str(e)}})


@app.get("/health")
def health():
    return {"status": "ok", "service": SERVICE_NAME, "default_engine": DEFAULT_ENGINE}


@app.get("/v1/engines")
def engines():
    return {"default": DEFAULT_ENGINE, "engines": [asdict(e) for e in list_engines()]}


@app.post("/v1/scan/prompt")
def scan_prompt(req: ScanRequest):
    engine = _resolve_engine(req.engine, "prompt")
    return _run(engine.scan_prompt, req.text)


@app.post("/v1/scan/output")
def scan_output(req: ScanRequest):
    engine = _resolve_engine(req.engine, "output")
    return _run(engine.scan_output, req.text)
