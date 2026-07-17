"""safAIr Orchestrator: Policies, LLM-Provider und die Safety-Pipeline (/v1/chat)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import db, providers
from .pipeline import run_pipeline

SERVICE_NAME = "orchestrator"


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="safAIr Orchestrator", version="0.1.0", lifespan=lifespan)


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
