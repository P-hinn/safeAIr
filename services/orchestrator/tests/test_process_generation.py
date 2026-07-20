import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.process_generation import (
    DraftActivity,
    DraftFlow,
    DraftLane,
    InvalidDraftError,
    ProcessDraft,
    ProcessGenerationRequest,
    ProviderNotConfiguredError,
    _api_key,
    _extract_response_text,
    generate_process_draft,
    validate_graph,
)
from app.main import app


def valid_draft() -> ProcessDraft:
    return ProcessDraft(
        name="Rechnung prüfen",
        description="Vom Eingang bis zur verbuchten Rechnung.",
        owner="Finance",
        domain="Finance",
        landscape_layer="support",
        lanes=[DraftLane(id="Lane_Finance", name="Finance")],
        activities=[
            DraftActivity(id="Start_1", name="Eingang", bpmn_element_type="startEvent", lane_id="Lane_Finance"),
            DraftActivity(id="Task_1", name="Prüfen", bpmn_element_type="businessRuleTask", lane_id="Lane_Finance", execution_mode="rule_automated", automation_potential="full"),
            DraftActivity(id="End_1", name="Verbucht", bpmn_element_type="endEvent", lane_id="Lane_Finance"),
        ],
        flows=[
            DraftFlow(id="Flow_1", source="Start_1", target="Task_1"),
            DraftFlow(id="Flow_2", source="Task_1", target="End_1"),
        ],
        assumptions=[],
        warnings=[],
    )


def test_valid_graph_is_accepted():
    assert validate_graph(valid_draft()).name == "Rechnung prüfen"


def test_invalid_reference_is_rejected():
    draft = valid_draft()
    draft.flows[0].target = "Missing"
    with pytest.raises(InvalidDraftError, match="ungültigen Referenzen"):
        validate_graph(draft)


def test_missing_end_is_rejected():
    draft = valid_draft()
    draft.activities[-1].bpmn_element_type = "task"
    with pytest.raises(InvalidDraftError, match="Start- und ein Endereignis"):
        validate_graph(draft)


def test_unreachable_activity_is_rejected():
    draft = valid_draft()
    draft.activities.append(DraftActivity(id="Task_Orphan", name="Verwaist", bpmn_element_type="task", lane_id="Lane_Finance"))
    with pytest.raises(InvalidDraftError, match="Nicht vom Start erreichbar"):
        validate_graph(draft)


def test_exactly_one_repair_attempt_is_used():
    invalid = valid_draft()
    invalid.flows[0].target = "Missing"
    request = ProcessGenerationRequest(description="Eine Rechnung wird geprüft und anschließend im ERP verbucht.")
    mocked = AsyncMock(side_effect=[invalid, valid_draft()])
    with patch("app.process_generation._request_draft", mocked):
        result = asyncio.run(generate_process_draft(request))
    assert result.name == "Rechnung prüfen"
    assert mocked.await_count == 2


def test_missing_provider_key_has_stable_error(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(ProviderNotConfiguredError):
        _api_key()


def test_refusal_is_reported_as_invalid_draft():
    with pytest.raises(InvalidDraftError, match="nicht unterstützt"):
        _extract_response_text({"output": [{"content": [{"type": "refusal", "refusal": "Anfrage nicht unterstützt"}]}]})


def test_generate_endpoint_reports_missing_provider(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = TestClient(app).post("/v1/processes/generate", json={"description": "Eine Rechnung wird geprüft und anschließend im ERP verbucht."})
    assert response.status_code == 503
    assert response.json()["detail"]["error"]["code"] == "provider_not_configured"


def test_audio_endpoint_rejects_wrong_type():
    response = TestClient(app).post("/v1/audio/transcriptions", files={"audio": ("note.txt", b"text", "text/plain")})
    assert response.status_code == 422
    assert response.json()["detail"]["error"]["code"] == "invalid_audio_type"


def test_generate_endpoint_returns_mocked_valid_draft():
    with patch("app.main.generate_process_draft", AsyncMock(return_value=valid_draft())):
        response = TestClient(app).post("/v1/processes/generate", json={"description": "Eine Rechnung wird geprüft und anschließend im ERP verbucht."})
    assert response.status_code == 200
    assert response.json()["activities"][1]["execution_mode"] == "rule_automated"
