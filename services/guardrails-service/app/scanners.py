"""Heuristik-Scanner: leichtgewichtige Regex-/Regel-Checks ohne ML-Abhängigkeiten."""

import re
from dataclasses import dataclass, field


@dataclass
class ScanResult:
    valid: bool
    risk_score: float  # 0.0 (harmlos) – 1.0 (kritisch)
    triggered: list[dict] = field(default_factory=list)
    engine: str = "heuristic"


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
