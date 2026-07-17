"""safAIr PII-Service: PII-Erkennung & Anonymisierung auf Basis von Microsoft Presidio."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .engine import get_analyzer, get_anonymizer, get_languages

SERVICE_NAME = "pii-service"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Modelle beim Start laden statt beim ersten Request
    get_analyzer()
    get_anonymizer()
    yield


app = FastAPI(title="safAIr PII Service", version="0.1.0", lifespan=lifespan)


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "en"
    entities: list[str] | None = Field(
        default=None, description="Optional: nur diese Entitätstypen suchen (z. B. EMAIL_ADDRESS)"
    )


class Finding(BaseModel):
    entity_type: str
    start: int
    end: int
    score: float
    text: str


class AnalyzeResponse(BaseModel):
    language: str
    findings: list[Finding]


class AnonymizeRequest(AnalyzeRequest):
    pass


class AnonymizeResponse(BaseModel):
    language: str
    anonymized_text: str
    findings: list[Finding]


def _validate_language(language: str) -> None:
    if language not in get_languages():
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "unsupported_language", "message": f"Sprache '{language}' nicht aktiviert. Aktiv: {get_languages()}"}},
        )


def _analyze(req: AnalyzeRequest):
    _validate_language(req.language)
    return get_analyzer().analyze(text=req.text, language=req.language, entities=req.entities)


@app.get("/health")
def health():
    return {"status": "ok", "service": SERVICE_NAME, "languages": get_languages()}


@app.post("/v1/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    results = _analyze(req)
    return AnalyzeResponse(
        language=req.language,
        findings=[
            Finding(
                entity_type=r.entity_type,
                start=r.start,
                end=r.end,
                score=round(r.score, 3),
                text=req.text[r.start : r.end],
            )
            for r in results
        ],
    )


@app.post("/v1/anonymize", response_model=AnonymizeResponse)
def anonymize(req: AnonymizeRequest):
    results = _analyze(req)
    anonymized = get_anonymizer().anonymize(text=req.text, analyzer_results=results)
    return AnonymizeResponse(
        language=req.language,
        anonymized_text=anonymized.text,
        findings=[
            Finding(
                entity_type=r.entity_type,
                start=r.start,
                end=r.end,
                score=round(r.score, 3),
                text=req.text[r.start : r.end],
            )
            for r in results
        ],
    )
