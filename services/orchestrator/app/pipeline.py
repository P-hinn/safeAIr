"""Pipeline-Engine: führt eine Nachricht durch die konfigurierte Safety-Kette.

Ablauf (je nach Policy):
  1. pii_prompt          PII maskieren oder blockieren
  2. guardrails_prompt   Prompt Injection / Secrets
  3. moderation_prompt   Llama Guard
  4. llm                 eigentlicher LLM-Call
  5. guardrails_output   Output-Scan
  6. moderation_output   Llama Guard auf Antwort
  7. pii_output          PII in der Antwort maskieren

Jeder Schritt erzeugt einen Trace-Eintrag:
  {step, status: ok|modified|blocked|warned|skipped|error, detail, duration_ms, data}

fail_closed=True: Fehler in einem Safety-Schritt blockiert die Anfrage.
fail_closed=False: Fehler wird als "error" markiert, Pipeline läuft weiter.
"""

import os
import time

import httpx

from . import providers

PII_URL = os.environ.get("PII_SERVICE_URL", "http://pii-service:8001")
GUARDRAILS_URL = os.environ.get("GUARDRAILS_SERVICE_URL", "http://guardrails-service:8002")
MODERATION_URL = os.environ.get("MODERATION_SERVICE_URL", "http://moderation-service:8003")

TIMEOUT = 30.0


class PipelineBlocked(Exception):
    def __init__(self, step: str, detail: str):
        self.step = step
        self.detail = detail
        super().__init__(detail)


def _post(url: str, body: dict) -> dict:
    r = httpx.post(url, json=body, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


class Trace:
    def __init__(self, fail_closed: bool):
        self.entries: list[dict] = []
        self.fail_closed = fail_closed

    def add(self, step: str, status: str, detail: str, started: float, data: dict | None = None):
        self.entries.append(
            {
                "step": step,
                "status": status,
                "detail": detail,
                "duration_ms": round((time.monotonic() - started) * 1000),
                "data": data or {},
            }
        )

    def skipped(self, step: str, detail: str = "In Policy deaktiviert"):
        self.entries.append({"step": step, "status": "skipped", "detail": detail, "duration_ms": 0, "data": {}})

    def handle_error(self, step: str, err: Exception, started: float):
        detail = f"Service-Fehler: {err}"
        if self.fail_closed:
            self.add(step, "blocked", detail + " (fail_closed aktiv)", started)
            raise PipelineBlocked(step, detail)
        self.add(step, "error", detail + " – Schritt übersprungen (fail_open)", started)


def _pii_step(step_name: str, cfg: dict, text: str, language: str, trace: Trace) -> str:
    if not cfg.get("enabled"):
        trace.skipped(step_name)
        return text
    started = time.monotonic()
    try:
        result = _post(
            f"{PII_URL}/v1/anonymize",
            {"text": text, "language": language, "engine": cfg.get("engine", "presidio")},
        )
    except httpx.HTTPError as e:
        trace.handle_error(step_name, e, started)
        return text
    findings = result.get("findings", [])
    entities = sorted({f["entity_type"] for f in findings})
    if not findings:
        trace.add(step_name, "ok", "Keine PII gefunden", started)
        return text
    if cfg.get("mode") == "block":
        trace.add(step_name, "blocked", f"PII gefunden: {', '.join(entities)}", started, {"findings": findings})
        raise PipelineBlocked(step_name, f"PII gefunden: {', '.join(entities)}")
    trace.add(
        step_name,
        "modified",
        f"{len(findings)} PII-Fundstellen maskiert ({', '.join(entities)})",
        started,
        {"findings": findings},
    )
    return result["anonymized_text"]


def _guardrails_step(step_name: str, scope: str, cfg: dict, text: str, trace: Trace) -> None:
    if not cfg.get("enabled"):
        trace.skipped(step_name)
        return
    started = time.monotonic()
    try:
        result = _post(
            f"{GUARDRAILS_URL}/v1/scan/{scope}",
            {"text": text, "engine": cfg.get("engine", "heuristic")},
        )
    except httpx.HTTPError as e:
        trace.handle_error(step_name, e, started)
        return
    if result.get("valid", True):
        trace.add(step_name, "ok", "Keine Auffälligkeiten", started, {"risk_score": result.get("risk_score", 0)})
        return
    rules = ", ".join(t.get("rule", "?") for t in result.get("triggered", []))
    detail = f"Ausgelöst: {rules} (risk {result.get('risk_score')})"
    if cfg.get("action") == "block":
        trace.add(step_name, "blocked", detail, started, result)
        raise PipelineBlocked(step_name, detail)
    trace.add(step_name, "warned", detail, started, result)


def _moderation_step(step_name: str, role: str, cfg: dict, text: str, trace: Trace) -> None:
    if not cfg.get("enabled"):
        trace.skipped(step_name)
        return
    started = time.monotonic()
    try:
        result = _post(f"{MODERATION_URL}/v1/moderate", {"text": text, "role": role})
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            trace.add(step_name, "skipped", "Llama Guard nicht konfiguriert (OLLAMA_URL)", started)
            return
        trace.handle_error(step_name, e, started)
        return
    except httpx.HTTPError as e:
        trace.handle_error(step_name, e, started)
        return
    if result.get("safe", True):
        trace.add(step_name, "ok", "Als unbedenklich eingestuft", started)
        return
    cats = ", ".join(c.get("label", c.get("code", "?")) for c in result.get("categories", []))
    detail = f"Als unsicher eingestuft: {cats}"
    if cfg.get("action") == "block":
        trace.add(step_name, "blocked", detail, started, result)
        raise PipelineBlocked(step_name, detail)
    trace.add(step_name, "warned", detail, started, result)


def run_pipeline(
    message: str,
    history: list[dict],
    policy: dict,
    provider_override: str | None = None,
    model_override: str | None = None,
) -> dict:
    cfg = policy["config"]
    language = cfg.get("language", "de")
    trace = Trace(fail_closed=bool(cfg.get("fail_closed")))
    blocked_step = None
    reply = ""

    try:
        # --- Eingangsseite ---
        message = _pii_step("pii_prompt", cfg.get("pii_prompt", {}), message, language, trace)
        _guardrails_step("guardrails_prompt", "prompt", cfg.get("guardrails_prompt", {}), message, trace)
        _moderation_step("moderation_prompt", "user", cfg.get("moderation_prompt", {}), message, trace)

        # --- LLM ---
        llm_cfg = cfg.get("llm", {})
        provider = provider_override or llm_cfg.get("provider", "ollama")
        model = model_override or llm_cfg.get("model", "llama3.2")
        started = time.monotonic()
        try:
            reply = providers.chat(provider, model, history + [{"role": "user", "content": message}])
            trace.add("llm", "ok", f"{provider} / {model}", started)
        except (RuntimeError, httpx.HTTPError) as e:
            trace.add("llm", "error", f"LLM-Fehler ({provider}/{model}): {e}", started)
            raise PipelineBlocked("llm", f"LLM-Aufruf fehlgeschlagen: {e}")

        # --- Ausgangsseite ---
        _guardrails_step("guardrails_output", "output", cfg.get("guardrails_output", {}), reply, trace)
        _moderation_step("moderation_output", "assistant", cfg.get("moderation_output", {}), reply, trace)
        reply = _pii_step("pii_output", cfg.get("pii_output", {}), reply, language, trace)

    except PipelineBlocked as b:
        blocked_step = b.step
        reply = f"🛡️ Anfrage blockiert (Schritt: {b.step}): {b.detail}"

    return {
        "reply": reply,
        "blocked": blocked_step is not None,
        "blocked_step": blocked_step,
        "processed_prompt": message,
        "trace": trace.entries,
    }
