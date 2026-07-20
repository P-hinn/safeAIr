"""Validated BPMN process drafts and OpenAI-backed generation/transcription."""

from __future__ import annotations

import json
import os
import re
from typing import Literal

import httpx
from pydantic import BaseModel, Field

OPENAI_API_URL = "https://api.openai.com/v1"
OPENAI_TIMEOUT = 150.0


class ProviderNotConfiguredError(RuntimeError):
    pass


class InvalidDraftError(ValueError):
    pass


class ProviderResponseError(RuntimeError):
    pass


class ProcessGenerationRequest(BaseModel):
    description: str = Field(min_length=20, max_length=20_000)
    company_context: str | None = Field(default=None, max_length=8_000)


class DraftLane(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z_][A-Za-z0-9_.-]*$")
    name: str = Field(min_length=1, max_length=160)


class DraftActivity(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z_][A-Za-z0-9_.-]*$")
    name: str = Field(min_length=1, max_length=180)
    description: str = Field(default="", max_length=1_500)
    bpmn_element_type: Literal[
        "startEvent", "endEvent", "task", "userTask", "manualTask", "serviceTask",
        "scriptTask", "businessRuleTask", "sendTask", "receiveTask", "exclusiveGateway",
        "inclusiveGateway", "parallelGateway", "subProcess", "callActivity"
    ]
    lane_id: str | None = None
    execution_mode: Literal["manual", "rule_automated", "ai_assisted", "ai_autonomous"] = "manual"
    automation_potential: Literal["none", "partial", "full"] = "none"
    risk: Literal["low", "medium", "high"] = "medium"
    human_approval: bool = False
    control: str = Field(default="", max_length=1_500)


class DraftFlow(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z_][A-Za-z0-9_.-]*$")
    source: str
    target: str
    label: str | None = Field(default=None, max_length=180)


class ProcessDraft(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    description: str = Field(min_length=1, max_length=3_000)
    owner: str = Field(default="Noch nicht zugewiesen", max_length=180)
    domain: str = Field(default="Geschäftsprozesse", max_length=180)
    landscape_layer: Literal["management", "core", "support"] = "core"
    lanes: list[DraftLane] = Field(default_factory=list, max_length=20)
    activities: list[DraftActivity] = Field(min_length=3, max_length=80)
    flows: list[DraftFlow] = Field(min_length=2, max_length=160)
    assumptions: list[str] = Field(default_factory=list, max_length=20)
    warnings: list[str] = Field(default_factory=list, max_length=20)


def _error(message: str) -> InvalidDraftError:
    return InvalidDraftError(message)


def validate_graph(draft: ProcessDraft) -> ProcessDraft:
    node_ids = [activity.id for activity in draft.activities]
    flow_ids = [flow.id for flow in draft.flows]
    lane_ids = {lane.id for lane in draft.lanes}
    if len(node_ids) != len(set(node_ids)):
        raise _error("Aktivitäts-IDs müssen eindeutig sein.")
    if len(flow_ids) != len(set(flow_ids)):
        raise _error("Flow-IDs müssen eindeutig sein.")
    unknown_lanes = sorted({activity.lane_id for activity in draft.activities if activity.lane_id and activity.lane_id not in lane_ids})
    if unknown_lanes:
        raise _error(f"Unbekannte Lane-Referenzen: {', '.join(unknown_lanes)}")
    node_set = set(node_ids)
    invalid_flows = [flow.id for flow in draft.flows if flow.source not in node_set or flow.target not in node_set]
    if invalid_flows:
        raise _error(f"Flows mit ungültigen Referenzen: {', '.join(invalid_flows)}")
    starts = {activity.id for activity in draft.activities if activity.bpmn_element_type == "startEvent"}
    ends = {activity.id for activity in draft.activities if activity.bpmn_element_type == "endEvent"}
    if not starts or not ends:
        raise _error("Der Entwurf benötigt mindestens ein Start- und ein Endereignis.")

    outgoing: dict[str, set[str]] = {node_id: set() for node_id in node_ids}
    incoming: dict[str, set[str]] = {node_id: set() for node_id in node_ids}
    for flow in draft.flows:
        outgoing[flow.source].add(flow.target)
        incoming[flow.target].add(flow.source)

    reachable = set(starts)
    queue = list(starts)
    while queue:
        current = queue.pop()
        for target in outgoing[current] - reachable:
            reachable.add(target)
            queue.append(target)
    unreachable = node_set - reachable
    if unreachable:
        raise _error(f"Nicht vom Start erreichbare Elemente: {', '.join(sorted(unreachable))}")

    can_finish = set(ends)
    queue = list(ends)
    while queue:
        current = queue.pop()
        for source in incoming[current] - can_finish:
            can_finish.add(source)
            queue.append(source)
    dead_ends = node_set - can_finish
    if dead_ends:
        raise _error(f"Elemente ohne Pfad zu einem Ende: {', '.join(sorted(dead_ends))}")
    return draft


def _api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise ProviderNotConfiguredError("OPENAI_API_KEY ist nicht konfiguriert.")
    return key


def _extract_response_text(payload: dict) -> str:
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "refusal":
                raise InvalidDraftError(content.get("refusal") or "Die Anfrage wurde vom Modell abgelehnt.")
            if content.get("type") == "output_text" and content.get("text"):
                return content["text"]
    raise ProviderResponseError("Die OpenAI-Antwort enthielt keinen strukturierten Entwurf.")


def _strict_schema(value):
    if isinstance(value, dict):
        result = {key: _strict_schema(item) for key, item in value.items() if key != "default"}
        if result.get("type") == "object" and "properties" in result:
            result["additionalProperties"] = False
            result["required"] = list(result["properties"].keys())
        return result
    if isinstance(value, list):
        return [_strict_schema(item) for item in value]
    return value


async def _request_draft(description: str, company_context: str | None, repair_error: str | None = None) -> ProcessDraft:
    schema = _strict_schema(ProcessDraft.model_json_schema())
    system_prompt = (
        "Du bist ein BPMN-2.0-Prozessarchitekt. Erzeuge einen fachlich prüfbaren, kompakten Prozessentwurf. "
        "Nutze stabile ASCII-IDs, mindestens ein Start- und Endereignis, gültige Flows und sinnvolle Lanes. "
        "Trenne manuelle, regelbasierte und KI-basierte Ausführung strikt. Safety-, PII- oder Testtools machen "
        "eine Aktivität nicht automatisch zu einer KI-Aktivität. Nenne Unsicherheiten als Annahmen oder Warnungen."
    )
    user_prompt = f"Prozessbeschreibung:\n{description}"
    if company_context:
        user_prompt += f"\n\nUnternehmenskontext:\n{company_context}"
    if repair_error:
        user_prompt += f"\n\nDer erste Entwurf war graphisch ungültig. Korrigiere genau diese Fehler: {repair_error}"
    body = {
        "model": os.environ.get("OPENAI_PROCESS_MODEL", "gpt-5.6-terra"),
        "store": False,
        "reasoning": {"effort": "medium"},
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "safair_process_draft",
                "strict": True,
                "schema": schema,
            }
        },
    }
    async with httpx.AsyncClient(timeout=OPENAI_TIMEOUT) as client:
        response = await client.post(
            f"{OPENAI_API_URL}/responses",
            headers={"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"},
            json=body,
        )
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = re.sub(r"\s+", " ", response.text)[:500]
        raise ProviderResponseError(f"OpenAI Responses API: {response.status_code} {detail}") from exc
    try:
        return ProcessDraft.model_validate_json(_extract_response_text(response.json()))
    except (json.JSONDecodeError, ValueError) as exc:
        if isinstance(exc, InvalidDraftError):
            raise
        raise InvalidDraftError(f"Strukturierte Ausgabe ist ungültig: {exc}") from exc


async def generate_process_draft(request: ProcessGenerationRequest) -> ProcessDraft:
    first = await _request_draft(request.description, request.company_context)
    try:
        return validate_graph(first)
    except InvalidDraftError as first_error:
        repaired = await _request_draft(request.description, request.company_context, str(first_error))
        return validate_graph(repaired)


async def transcribe_audio(filename: str, content: bytes, content_type: str) -> dict:
    model = os.environ.get("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-transcribe")
    async with httpx.AsyncClient(timeout=OPENAI_TIMEOUT) as client:
        response = await client.post(
            f"{OPENAI_API_URL}/audio/transcriptions",
            headers={"Authorization": f"Bearer {_api_key()}"},
            data={"model": model, "response_format": "json"},
            files={"file": (filename, content, content_type)},
        )
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = re.sub(r"\s+", " ", response.text)[:500]
        raise ProviderResponseError(f"OpenAI Transcription API: {response.status_code} {detail}") from exc
    text = str(response.json().get("text", "")).strip()
    if not text:
        raise InvalidDraftError("Die Audiodatei enthielt kein verwertbares Transkript.")
    return {"text": text, "model": model}
