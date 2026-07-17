"""Presidio Analyzer/Anonymizer Setup mit Mehrsprachigkeit (en/de)."""

import os
from functools import lru_cache

from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine

SPACY_MODELS = {
    "en": "en_core_web_sm",
    "de": "de_core_news_sm",
}


def get_languages() -> list[str]:
    raw = os.environ.get("PII_LANGUAGES", "en,de")
    langs = [lang.strip() for lang in raw.split(",") if lang.strip()]
    unknown = [lang for lang in langs if lang not in SPACY_MODELS]
    if unknown:
        raise ValueError(f"Nicht unterstützte Sprachen: {unknown}. Unterstützt: {list(SPACY_MODELS)}")
    return langs


@lru_cache(maxsize=1)
def get_analyzer() -> AnalyzerEngine:
    languages = get_languages()
    provider = NlpEngineProvider(
        nlp_configuration={
            "nlp_engine_name": "spacy",
            "models": [
                {"lang_code": lang, "model_name": SPACY_MODELS[lang]} for lang in languages
            ],
        }
    )
    return AnalyzerEngine(
        nlp_engine=provider.create_engine(),
        supported_languages=languages,
    )


@lru_cache(maxsize=1)
def get_anonymizer() -> AnonymizerEngine:
    return AnonymizerEngine()
