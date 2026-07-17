"""Scanner-Engines für den Guardrails-Service.

Zwei Engines, wählbar über GUARDRAILS_ENGINE:
- "heuristic" (Default): leichtgewichtige Regex-/Regel-Checks, keine ML-Abhängigkeiten.
- "llm-guard": nutzt protectai/llm-guard (muss in requirements.txt aktiviert sein).
"""

import os
import re
from dataclasses import dataclass, field


@dataclass
class ScanResult:
    valid: bool
    risk_score: float  # 0.0 (harmlos) – 1.0 (kritisch)
    triggered: list[dict] = field(default_factory=list)
    engine: str = "heuristic"


# --- Heuristik-Engine -------------------------------------------------------

_INJECTION_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("ignore_instructions", re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", re.I)),
    ("ignore_instructions_de", re.compile(r"ignoriere?\s+(alle\s+)?(vorherigen|bisherigen|obigen)\s+(anweisungen|instruktionen)", re.I)),
    ("reveal_system_prompt", re.compile(r"(reveal|show|print|repeat|verrate|zeige?)\b.{0,40}\b(system\s*prompt|instructions|anweisungen)", re.I)),
    ("role_override", re.compile(r"\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|du\s+bist\s+(jetzt|ab\s+sofort))\b", re.I)),
    ("jailbreak_marker", re.compile(r"\b(DAN|do\s+anything\s+now|developer\s+mode|jailbreak)\b", re.I)),
]

_SECRET_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("api_key", re.compile(r"\b(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36})\b")),
    ("private_key_block", re.compile(r"-----BEGIN\s+[A-Z ]*PRIVATE KEY-----")),
    ("password_assignment", re.compile(r"\b(passwor[dt]|secret|token)\s*[:=]\s*\S{6,}", re.I)),
]


def _heuristic_scan(text: str, pattern_sets: list[tuple[str, list[tuple[str, re.Pattern]]]]) -> ScanResult:
    triggered = []
    for category, patterns in pattern_sets:
        for name, pattern in patterns:
            match = pattern.search(text)
            if match:
                triggered.append({"category": category, "rule": name, "match": match.group(0)[:80]})
    risk = min(1.0, 0.5 * len(triggered)) if triggered else 0.0
    return ScanResult(valid=not triggered, risk_score=risk, triggered=triggered, engine="heuristic")


def heuristic_scan_prompt(text: str) -> ScanResult:
    return _heuristic_scan(text, [("prompt_injection", _INJECTION_PATTERNS), ("secrets", _SECRET_PATTERNS)])


def heuristic_scan_output(text: str) -> ScanResult:
    return _heuristic_scan(text, [("secrets", _SECRET_PATTERNS)])


# --- LLM-Guard-Engine (optional) -------------------------------------------

def _llm_guard_scan_prompt(text: str) -> ScanResult:
    from llm_guard import scan_prompt
    from llm_guard.input_scanners import PromptInjection, Secrets, Toxicity

    scanners = [PromptInjection(), Secrets(), Toxicity()]
    _, results_valid, results_score = scan_prompt(scanners, text)
    triggered = [
        {"category": "llm-guard", "rule": name, "score": round(score, 3)}
        for name, (valid, score) in (
            (n, (results_valid[n], results_score[n])) for n in results_valid
        )
        if not valid
    ]
    risk = max(results_score.values(), default=0.0)
    return ScanResult(valid=all(results_valid.values()), risk_score=round(risk, 3), triggered=triggered, engine="llm-guard")


def _llm_guard_scan_output(text: str) -> ScanResult:
    from llm_guard import scan_output
    from llm_guard.output_scanners import Sensitive, Toxicity

    scanners = [Sensitive(), Toxicity()]
    _, results_valid, results_score = scan_output(scanners, prompt="", output=text)
    triggered = [
        {"category": "llm-guard", "rule": name, "score": round(score, 3)}
        for name, (valid, score) in (
            (n, (results_valid[n], results_score[n])) for n in results_valid
        )
        if not valid
    ]
    risk = max(results_score.values(), default=0.0)
    return ScanResult(valid=all(results_valid.values()), risk_score=round(risk, 3), triggered=triggered, engine="llm-guard")


# --- Öffentliche API --------------------------------------------------------

def get_engine_name() -> str:
    return os.environ.get("GUARDRAILS_ENGINE", "heuristic").lower()


def scan_prompt_text(text: str) -> ScanResult:
    if get_engine_name() == "llm-guard":
        return _llm_guard_scan_prompt(text)
    return heuristic_scan_prompt(text)


def scan_output_text(text: str) -> ScanResult:
    if get_engine_name() == "llm-guard":
        return _llm_guard_scan_output(text)
    return heuristic_scan_output(text)
