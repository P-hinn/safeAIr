"""Engine-Registry des Guardrails-Service.

Engines:
- heuristic          leichtgewichtige Regex-Checks, sofort lauffähig (Default)
- llm-guard          protectai/llm-guard (ML-Modelle, optional installieren)
- guardrails-ai      guardrails-ai/guardrails (Validatoren via Guardrails Hub)
- nemo-guardrails    NVIDIA NeMo Guardrails (Rails-Config + LLM-Key nötig)
- openai-guardrails  openai/openai-guardrails-python (OpenAI-Key nötig)
- lakera             Lakera Guard Cloud-API (LAKERA_GUARD_API_KEY nötig)
"""

import importlib.util
import os
from dataclasses import dataclass, field

from .scanners import ScanResult, heuristic_scan_output, heuristic_scan_prompt


@dataclass
class EngineInfo:
    name: str
    title: str
    status: str  # "ready" | "not_installed" | "not_configured"
    detail: str = ""
    docs_url: str = ""
    scopes: list[str] = field(default_factory=lambda: ["prompt", "output"])


def _installed(module: str) -> bool:
    return importlib.util.find_spec(module) is not None


# --- Engines ----------------------------------------------------------------


class HeuristicEngine:
    name = "heuristic"

    def info(self) -> EngineInfo:
        return EngineInfo(
            name=self.name,
            title="safAIr Heuristik",
            status="ready",
            detail="Regex-/Regel-Checks (Prompt Injection, Secrets). Kein ML, Default.",
        )

    def scan_prompt(self, text: str) -> ScanResult:
        return heuristic_scan_prompt(text)

    def scan_output(self, text: str) -> ScanResult:
        return heuristic_scan_output(text)


class LlmGuardEngine:
    name = "llm-guard"

    def info(self) -> EngineInfo:
        ok = _installed("llm_guard")
        return EngineInfo(
            name=self.name,
            title="LLM Guard (Protect AI)",
            status="ready" if ok else "not_installed",
            detail="ML-basierte Scanner (PromptInjection, Toxicity, Secrets, …)."
            if ok
            else "In requirements.txt 'llm-guard' aktivieren (lädt Modelle beim ersten Start).",
            docs_url="https://github.com/protectai/llm-guard",
        )

    def scan_prompt(self, text: str) -> ScanResult:
        from llm_guard import scan_prompt
        from llm_guard.input_scanners import PromptInjection, Secrets, Toxicity

        _, valid, scores = scan_prompt([PromptInjection(), Secrets(), Toxicity()], text)
        return _llm_guard_result(valid, scores)

    def scan_output(self, text: str) -> ScanResult:
        from llm_guard import scan_output
        from llm_guard.output_scanners import Sensitive, Toxicity

        _, valid, scores = scan_output([Sensitive(), Toxicity()], prompt="", output=text)
        return _llm_guard_result(valid, scores)


def _llm_guard_result(valid: dict, scores: dict) -> ScanResult:
    triggered = [
        {"category": "llm-guard", "rule": name, "score": round(scores[name], 3)}
        for name, ok in valid.items()
        if not ok
    ]
    return ScanResult(
        valid=all(valid.values()),
        risk_score=round(max(scores.values(), default=0.0), 3),
        triggered=triggered,
        engine="llm-guard",
    )


class GuardrailsAiEngine:
    name = "guardrails-ai"

    def info(self) -> EngineInfo:
        if not _installed("guardrails"):
            return EngineInfo(
                name=self.name,
                title="Guardrails AI",
                status="not_installed",
                detail="pip install guardrails-ai, dann Validatoren via 'guardrails hub install …'.",
                docs_url="https://github.com/guardrails-ai/guardrails",
            )
        return EngineInfo(
            name=self.name,
            title="Guardrails AI",
            status="not_configured",
            detail="Engine-Platzhalter: Paket ist installiert, die Anbindung eines Guards mit Hub-Validatoren ist noch nicht umgesetzt.",
            docs_url="https://github.com/guardrails-ai/guardrails",
        )

    def scan_prompt(self, text: str) -> ScanResult:
        raise NotImplementedError(self.info().detail)

    def scan_output(self, text: str) -> ScanResult:
        raise NotImplementedError(self.info().detail)


class NemoGuardrailsEngine:
    name = "nemo-guardrails"

    def _config_path(self) -> str:
        return os.environ.get("NEMO_CONFIG_PATH", "")

    def info(self) -> EngineInfo:
        if not _installed("nemoguardrails"):
            status, detail = "not_installed", "In requirements.txt 'nemoguardrails' aktivieren."
        elif not self._config_path() or not os.path.isdir(self._config_path()):
            status, detail = (
                "not_configured",
                "NEMO_CONFIG_PATH auf ein Rails-Config-Verzeichnis setzen (plus LLM-API-Key).",
            )
        else:
            status, detail = "ready", "Colang-Rails aktiv."
        return EngineInfo(
            name=self.name,
            title="NVIDIA NeMo Guardrails",
            status=status,
            detail=detail,
            docs_url="https://docs.nvidia.com/nemo/guardrails/",
            scopes=["prompt"],
        )

    def scan_prompt(self, text: str) -> ScanResult:
        from nemoguardrails import LLMRails, RailsConfig

        rails = LLMRails(RailsConfig.from_path(self._config_path()))
        response = rails.generate(messages=[{"role": "user", "content": text}])
        content = (response or {}).get("content", "")
        blocked = "can't" in content.lower() or "cannot" in content.lower()
        return ScanResult(
            valid=not blocked,
            risk_score=1.0 if blocked else 0.0,
            triggered=[{"category": "nemo", "rule": "rails", "response": content[:200]}] if blocked else [],
            engine=self.name,
        )

    def scan_output(self, text: str) -> ScanResult:
        raise NotImplementedError("NeMo-Engine ist aktuell nur für Prompt-Scans angebunden.")


class OpenAiGuardrailsEngine:
    name = "openai-guardrails"

    def info(self) -> EngineInfo:
        return EngineInfo(
            name=self.name,
            title="OpenAI Guardrails",
            status="not_configured",
            detail=(
                "Engine-Platzhalter: Anbindung noch nicht umgesetzt. Benötigt später OPENAI_API_KEY und das Paket "
                "'openai-guardrails' (Namespace-Konflikt mit guardrails-ai – nicht beide gleichzeitig installieren)."
            ),
            docs_url="https://github.com/openai/openai-guardrails-python",
        )

    def scan_prompt(self, text: str) -> ScanResult:
        raise NotImplementedError(self.info().detail)

    def scan_output(self, text: str) -> ScanResult:
        raise NotImplementedError(self.info().detail)


class LakeraEngine:
    name = "lakera"

    def _api_key(self) -> str:
        return os.environ.get("LAKERA_GUARD_API_KEY", "")

    def info(self) -> EngineInfo:
        return EngineInfo(
            name=self.name,
            title="Lakera Guard (Cloud)",
            status="ready" if self._api_key() else "not_configured",
            detail="Managed API für Prompt Injection, Jailbreaks, PII u. a."
            if self._api_key()
            else "LAKERA_GUARD_API_KEY in .env setzen (https://platform.lakera.ai).",
            docs_url="https://www.lakera.ai/",
        )

    def _scan(self, text: str, role: str) -> ScanResult:
        import httpx

        response = httpx.post(
            "https://api.lakera.ai/v2/guard",
            headers={"Authorization": f"Bearer {self._api_key()}"},
            json={"messages": [{"role": role, "content": text}]},
            timeout=10.0,
        )
        response.raise_for_status()
        data = response.json()
        flagged = bool(data.get("flagged", False))
        return ScanResult(
            valid=not flagged,
            risk_score=1.0 if flagged else 0.0,
            triggered=[{"category": "lakera", "rule": "guard", "payload": data}] if flagged else [],
            engine=self.name,
        )

    def scan_prompt(self, text: str) -> ScanResult:
        return self._scan(text, "user")

    def scan_output(self, text: str) -> ScanResult:
        return self._scan(text, "assistant")


# --- Registry ---------------------------------------------------------------

_ENGINES = {
    e.name: e
    for e in [
        HeuristicEngine(),
        LlmGuardEngine(),
        GuardrailsAiEngine(),
        NemoGuardrailsEngine(),
        OpenAiGuardrailsEngine(),
        LakeraEngine(),
    ]
}

DEFAULT_ENGINE = os.environ.get("GUARDRAILS_ENGINE", "heuristic").lower()


def list_engines() -> list[EngineInfo]:
    return [e.info() for e in _ENGINES.values()]


def get_engine(name: str):
    if name not in _ENGINES:
        raise KeyError(f"Unbekannte Engine '{name}'. Verfügbar: {list(_ENGINES)}")
    return _ENGINES[name]
