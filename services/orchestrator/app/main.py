"""safAIr Orchestrator: Policies, LLM-Provider und die Safety-Pipeline (/v1/chat)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from . import db, providers
from .pipeline import run_pipeline
from .process_generation import (
    InvalidDraftError,
    ProcessGenerationRequest,
    ProviderNotConfiguredError,
    ProviderResponseError,
    generate_process_draft,
    transcribe_audio,
)

SERVICE_NAME = "orchestrator"


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="safAIr Orchestrator", version="0.1.0", lifespan=lifespan)
MAX_AUDIO_BYTES = 20 * 1024 * 1024
SUPPORTED_AUDIO_TYPES = {"audio/webm", "audio/mp4", "video/webm", "video/mp4"}


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list, max_length=50)
    policy_id: str = "standard"
    provider: str | None = None
    model: str | None = None


class PolicyRequest(BaseModel):
    name: str = Field(min_length=1)
    config: dict


@app.get("/health")
def health():
    return {"status": "ok", "service": SERVICE_NAME}


@app.get("/v1/providers")
def get_providers():
    return {"providers": providers.provider_infos()}


@app.get("/v1/policies")
def get_policies():
    return {"policies": db.list_policies()}


@app.post("/v1/policies", status_code=201)
def create_policy(req: PolicyRequest):
    return db.save_policy(req.name, req.config)


@app.put("/v1/policies/{policy_id}")
def update_policy(policy_id: str, req: PolicyRequest):
    if db.get_policy(policy_id) is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": f"Policy {policy_id} unbekannt"}})
    return db.save_policy(req.name, req.config, policy_id)


@app.delete("/v1/policies/{policy_id}")
def remove_policy(policy_id: str):
    if not db.delete_policy(policy_id):
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "not_deletable", "message": "Policy existiert nicht oder ist eine eingebaute Policy."}},
        )
    return {"deleted": policy_id}


@app.post("/v1/chat")
def chat(req: ChatRequest):
    policy = db.get_policy(req.policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": f"Policy {req.policy_id} unbekannt"}})
    return run_pipeline(
        message=req.message,
        history=[m.model_dump() for m in req.history],
        policy=policy,
        provider_override=req.provider,
        model_override=req.model,
    )


def _process_error(error: Exception):
    if isinstance(error, ProviderNotConfiguredError):
        raise HTTPException(
            status_code=503,
            detail={"error": {"code": "provider_not_configured", "message": str(error)}},
        ) from error
    if isinstance(error, InvalidDraftError):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "invalid_process_draft", "message": str(error)}},
        ) from error
    raise HTTPException(
        status_code=502,
        detail={"error": {"code": "provider_error", "message": str(error)}},
    ) from error


@app.post("/v1/processes/generate")
async def generate_process(request: ProcessGenerationRequest):
    try:
        return await generate_process_draft(request)
    except Exception as error:
        _process_error(error)


@app.post("/v1/audio/transcriptions")
async def create_transcription(audio: UploadFile = File(...)):
    content_type = (audio.content_type or "").split(";", 1)[0].lower()
    if content_type not in SUPPORTED_AUDIO_TYPES:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "invalid_audio_type", "message": "Unterstützt werden WebM- und MP4-Audiodateien."}},
        )
    content = await audio.read(MAX_AUDIO_BYTES + 1)
    await audio.close()
    if not content or len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "invalid_audio_size", "message": "Die Audiodatei darf höchstens 20 MB groß sein."}},
        )
    try:
        return await transcribe_audio(audio.filename or "sprachnotiz.webm", content, content_type)
    except Exception as error:
        _process_error(error)
