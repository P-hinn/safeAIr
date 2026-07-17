"""AWS Comprehend (PII) – Cloud-Adapter (benötigt AWS-Credentials + Region)."""

import importlib.util
import os

from .base import EngineInfo, PiiFinding, mask_by_findings

_INSTALLED = importlib.util.find_spec("boto3") is not None


def _configured() -> bool:
    return bool(os.environ.get("AWS_REGION")) and bool(os.environ.get("AWS_ACCESS_KEY_ID"))


class AwsComprehendEngine:
    name = "aws-comprehend"

    def info(self) -> EngineInfo:
        if not _INSTALLED:
            status, detail = "not_installed", "In requirements.txt 'boto3' aktivieren."
        elif not _configured():
            status, detail = (
                "not_configured",
                "AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in .env setzen.",
            )
        else:
            status, detail = "ready", "Cloud-API (detect_pii_entities), en/es u. a."
        return EngineInfo(
            name=self.name,
            title="AWS Comprehend (PII)",
            status=status,
            languages=["en", "es"],
            detail=detail,
            docs_url="https://aws.amazon.com/comprehend/",
        )

    def analyze(self, text: str, language: str) -> list[PiiFinding]:
        import boto3

        client = boto3.client("comprehend", region_name=os.environ["AWS_REGION"])
        response = client.detect_pii_entities(Text=text, LanguageCode=language if language in ("en", "es") else "en")
        return [
            PiiFinding(
                entity_type=e["Type"],
                start=e["BeginOffset"],
                end=e["EndOffset"],
                score=round(float(e["Score"]), 3),
                text=text[e["BeginOffset"] : e["EndOffset"]],
            )
            for e in response.get("Entities", [])
        ]

    def anonymize(self, text: str, language: str) -> tuple[str, list[PiiFinding]]:
        findings = self.analyze(text, language)
        return mask_by_findings(text, findings), findings
