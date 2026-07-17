"""Microsoft Presidio – lokale PII-Erkennung & Anonymisierung (Default-Engine)."""

from ..engine import get_analyzer, get_anonymizer, get_languages
from .base import EngineInfo, PiiFinding


class PresidioEngine:
    name = "presidio"

    def info(self) -> EngineInfo:
        return EngineInfo(
            name=self.name,
            title="Microsoft Presidio",
            status="ready",
            languages=get_languages(),
            detail="Lokal, spaCy-basiert. Default-Engine.",
            docs_url="https://microsoft.github.io/presidio/",
        )

    def _analyze_raw(self, text: str, language: str):
        return get_analyzer().analyze(text=text, language=language)

    def analyze(self, text: str, language: str) -> list[PiiFinding]:
        return [
            PiiFinding(
                entity_type=r.entity_type,
                start=r.start,
                end=r.end,
                score=round(r.score, 3),
                text=text[r.start : r.end],
            )
            for r in self._analyze_raw(text, language)
        ]

    def anonymize(self, text: str, language: str) -> tuple[str, list[PiiFinding]]:
        raw = self._analyze_raw(text, language)
        anonymized = get_anonymizer().anonymize(text=text, analyzer_results=raw)
        findings = [
            PiiFinding(
                entity_type=r.entity_type,
                start=r.start,
                end=r.end,
                score=round(r.score, 3),
                text=text[r.start : r.end],
            )
            for r in raw
        ]
        return anonymized.text, findings
