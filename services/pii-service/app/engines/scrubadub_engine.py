"""Scrubadub – leichtgewichtige, regelbasierte PII-Entfernung (englisch)."""

import importlib.util

from .base import EngineInfo, PiiFinding

_INSTALLED = importlib.util.find_spec("scrubadub") is not None


class ScrubadubEngine:
    name = "scrubadub"

    def info(self) -> EngineInfo:
        return EngineInfo(
            name=self.name,
            title="Scrubadub",
            status="ready" if _INSTALLED else "not_installed",
            languages=["en"],
            detail="Regelbasiert, sehr schnell, primär Englisch."
            if _INSTALLED
            else "pip install scrubadub (in requirements.txt enthalten)",
            docs_url="https://github.com/LeapBeyond/scrubadub",
        )

    def _scrubber(self):
        import scrubadub

        return scrubadub.Scrubber()

    def analyze(self, text: str, language: str) -> list[PiiFinding]:
        scrubber = self._scrubber()
        return [
            PiiFinding(
                entity_type=f.type.upper(),
                start=f.beg,
                end=f.end,
                score=1.0,
                text=f.text,
            )
            for f in scrubber.iter_filth(text)
        ]

    def anonymize(self, text: str, language: str) -> tuple[str, list[PiiFinding]]:
        findings = self.analyze(text, language)
        cleaned = self._scrubber().clean(text)
        return cleaned, findings
