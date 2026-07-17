from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class PiiFinding:
    entity_type: str
    start: int
    end: int
    score: float
    text: str


@dataclass
class EngineInfo:
    name: str
    title: str
    status: str  # "ready" | "not_installed" | "not_configured"
    languages: list[str] = field(default_factory=list)
    detail: str = ""
    docs_url: str = ""


class PiiEngine(Protocol):
    name: str

    def info(self) -> EngineInfo: ...

    def analyze(self, text: str, language: str) -> list[PiiFinding]: ...

    def anonymize(self, text: str, language: str) -> tuple[str, list[PiiFinding]]: ...


def mask_by_findings(text: str, findings: list[PiiFinding]) -> str:
    """Generische Anonymisierung: ersetzt Fundstellen von hinten nach vorn durch <TYP>."""
    result = text
    for f in sorted(findings, key=lambda f: f.start, reverse=True):
        result = result[: f.start] + f"<{f.entity_type}>" + result[f.end :]
    return result
