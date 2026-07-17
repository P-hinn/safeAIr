"""safAIr Guardrails-Service: Scans für Prompts und LLM-Outputs."""

from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .scanners import get_engine_name, scan_output_text, scan_prompt_text

SERVICE_NAME = "guardrails-service"

app = FastAPI(title="safAIr Guardrails Service", version="0.1.0")


class ScanRequest(BaseModel):
    text: str = Field(min_length=1)


@app.get("/health")
def health():
    return {"status": "ok", "service": SERVICE_NAME, "engine": get_engine_name()}


@app.post("/v1/scan/prompt")
def scan_prompt(req: ScanRequest):
    try:
        return asdict(scan_prompt_text(req.text))
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail={"error": {"code": "engine_unavailable", "message": "llm-guard ist nicht installiert. requirements.txt anpassen oder GUARDRAILS_ENGINE=heuristic setzen."}},
        )


@app.post("/v1/scan/output")
def scan_output(req: ScanRequest):
    try:
        return asdict(scan_output_text(req.text))
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail={"error": {"code": "engine_unavailable", "message": "llm-guard ist nicht installiert. requirements.txt anpassen oder GUARDRAILS_ENGINE=heuristic setzen."}},
        )
