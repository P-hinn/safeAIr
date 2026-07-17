"""safAIr PII-Service: PII-Erkennung & Anonymisierung mit austauschbaren Engines.

Engines: presidio (Default), scrubadub, gcp-dlp, aws-comprehend.
GET /v1/engines zeigt Verfügbarkeit und Aktivierungshinweise.
"""

from contextlib import asynccontextmanager
from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .engine import get_analyzer, get_anonymizer, get_languages
from .engines import DEFAULT_ENGINE, get_engine, list_engines

SERVICE_NAME = "pii-service"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Presidio-Modelle beim Start laden statt beim ersten Request
    get_analyzer()
    get_anonymizer()
    yield


app = FastAPI(title="safAIr PII Service", version="0.2.0", lifespan=lifespan)


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "en"
    engine: str = DEFAULT_ENGINE


class Finding(BaseModel):
    entity_type: str
    start: int
    end: int
    score: float
    text: str


class AnalyzeResponse(BaseModel):
    engine: str
    language: str
    findings: list[Finding]


class AnonymizeResponse(AnalyzeResponse):
    anonymized_text: str


def _resolve_engine(req: AnalyzeRequest):
    try:
        engine = get_engine(req.engine)
    except KeyError as e:
        raise HTTPException(status_code=422, detail={"error": {"code": "unknown_engine", "message": str(e)}})
    info = engine.info()
    if info.status != "ready":
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": f"engine_{info.status}", "message": f"{info.title}: {info.detail}"}},
        )
    if req.engine == "presidio" and req.language not in get_languages():
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "unsupported_language", "message": f"Sprache '{req.language}' nicht aktiviert. Aktiv: {get_languages()}"}},
        )
    return engine


@app.get("/health")
def health():
    return {"status": "ok", "service": SERVICE_NAME, "default_engine": DEFAULT_ENGINE}


@app.get("/v1/engines")
def engines():
    return {"default": DEFAULT_ENGINE, "engines": [asdict(e) for e in list_engines()]}


@app.post("/v1/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    engine = _resolve_engine(req)
    findings = engine.analyze(req.text, req.language)
    return AnalyzeResponse(
        engine=req.engine,
        language=req.language,
        findings=[Finding(**asdict(f)) for f in findings],
    )


@app.post("/v1/anonymize", response_model=AnonymizeResponse)
def anonymize(req: AnalyzeRequest):
    engine = _resolve_engine(req)
    anonymized_text, findings = engine.anonymize(req.text, req.language)
    return AnonymizeResponse(
        engine=req.engine,
        language=req.language,
        anonymized_text=anonymized_text,
        findings=[Finding(**asdict(f)) for f in findings],
    )
