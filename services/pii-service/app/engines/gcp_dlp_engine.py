"""Google Cloud DLP – Cloud-Adapter (benötigt GCP-Projekt + Credentials)."""

import importlib.util
import os

from .base import EngineInfo, PiiFinding, mask_by_findings

_INSTALLED = importlib.util.find_spec("google.cloud.dlp_v2") is not None


def _configured() -> bool:
    return bool(os.environ.get("GCP_PROJECT_ID")) and bool(
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    )


class GcpDlpEngine:
    name = "gcp-dlp"

    def info(self) -> EngineInfo:
        if not _INSTALLED:
            status, detail = "not_installed", "In requirements.txt 'google-cloud-dlp' aktivieren."
        elif not _configured():
            status, detail = (
                "not_configured",
                "GCP_PROJECT_ID und GOOGLE_APPLICATION_CREDENTIALS in .env setzen.",
            )
        else:
            status, detail = "ready", "Cloud-API, sehr breite Infotype-Abdeckung."
        return EngineInfo(
            name=self.name,
            title="Google Cloud DLP",
            status=status,
            languages=["*"],
            detail=detail,
            docs_url="https://cloud.google.com/security/products/dlp",
        )

    def _client(self):
        from google.cloud import dlp_v2

        return dlp_v2.DlpServiceClient()

    def analyze(self, text: str, language: str) -> list[PiiFinding]:
        client = self._client()
        parent = f"projects/{os.environ['GCP_PROJECT_ID']}"
        response = client.inspect_content(
            request={
                "parent": parent,
                "inspect_config": {"include_quote": True},
                "item": {"value": text},
            }
        )
        findings = []
        for f in response.result.findings:
            quote = f.quote or ""
            start = text.find(quote) if quote else 0
            findings.append(
                PiiFinding(
                    entity_type=f.info_type.name,
                    start=max(start, 0),
                    end=max(start, 0) + len(quote),
                    score=round({0: 0.0, 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1.0}.get(int(f.likelihood), 0.5), 3),
                    text=quote,
                )
            )
        return findings

    def anonymize(self, text: str, language: str) -> tuple[str, list[PiiFinding]]:
        findings = self.analyze(text, language)
        return mask_by_findings(text, findings), findings
