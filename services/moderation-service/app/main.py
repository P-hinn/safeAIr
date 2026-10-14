"""safAIr Moderation-Service: Content-Moderation mit Llama Guard (via Ollama).

Setup:
  1. Ollama installieren (https://ollama.com) und `ollama pull llama-guard3` ausführen.
  2. OLLAMA_URL in .env setzen (lokal meist http://host.docker.internal:11434).

Llama Guard antwortet mit "safe" oder "unsafe" plus den verletzten Kategorien
(S1–S14, MLCommons-Taxonomie: Gewalt, Hass, Sexualisierung Minderjähriger, …).
"""

import os

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

SERVICE_NAME = "moderation-service"

app = FastAPI(title="safAIr Moderation Service", version="0.1.0")

CATEGORY_LABELS = {
    "S1": "Violent Crimes",
    "S2": "Non-Violent Crimes",
    "S3": "Sex-Related Crimes",
    "S4": "Child Sexual Exploitation",
    "S5": "Defamation",
    "S6": "Specialized Advice",
    "S7": "Privacy",
    "S8": "Intellectual Property",
    "S9": "Indiscriminate Weapons",
    "S10": "Hate",
    "S11": "Suicide & Self-Harm",
    "S12": "Sexual Content",
    "S13": "Elections",
    "S14": "Code Interpreter Abuse",
}


def _ollama_url() -> str:
    return os.environ.get("OLLAMA_URL", "").rstrip("/")


def _model() -> str:
    return os.environ.get("MODERATION_MODEL", "llama-guard3")


class ModerateRequest(BaseModel):
    text: str = Field(min_length=1)
    role: str = Field(default="user", pattern="^(user|assistant)$")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "backend": "ollama" if _ollama_url() else "unconfigured",
        "model": _model(),
    }


@app.get("/v1/engines")
def engines():
    configured = bool(_ollama_url())
    return {
        "default": "llama-guard",
        "engines": [
            {
                "name": "llama-guard",
                "title": "Llama Guard 3 (Meta, via Ollama)",
                "status": "ready" if configured else "not_configured",
                "detail": f"Ollama konfiguriert, Modell {_model()}."
                if configured
                else "OLLAMA_URL in .env setzen und `ollama pull llama-guard3` ausführen.",
                "docs_url": "https://github.com/meta-llama/PurpleLlama",
            }
        ],
    }


@app.post("/v1/moderate")
def moderate(req: ModerateRequest):
    if not _ollama_url():
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "engine_not_configured", "message": "OLLAMA_URL in .env setzen und `ollama pull llama-guard3` ausführen."}},
        )
    try:
        response = httpx.post(
            f"{_ollama_url()}/api/chat",
            json={
                "model": _model(),
                "messages": [{"role": req.role, "content": req.text}],
                "stream": False,
            },
            timeout=60.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail={"error": {"code": "ollama_error", "message": str(e)}})

    raw = (response.json().get("message", {}).get("content", "") or "").strip()
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    is_safe = bool(lines) and lines[0].lower() == "safe"
    categories = []
    if not is_safe and len(lines) > 1:
        categories = [
            {"code": code, "label": CATEGORY_LABELS.get(code, "Unknown")}
            for code in lines[1].replace(" ", "").split(",")
            if code
        ]
    return {
        "safe": is_safe,
        "categories": categories,
        "model": _model(),
        "raw": raw[:500],
    }
