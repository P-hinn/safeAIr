"""Engine-Registry des PII-Service.

Jede Engine implementiert das PiiEngine-Protokoll (siehe base.py) und meldet
ihren Status: ready | not_installed | not_configured.
"""

from .base import EngineInfo, PiiEngine, PiiFinding
from .presidio_engine import PresidioEngine
from .scrubadub_engine import ScrubadubEngine
from .gcp_dlp_engine import GcpDlpEngine
from .aws_comprehend_engine import AwsComprehendEngine

_ENGINES: dict[str, PiiEngine] = {
    e.name: e
    for e in [
        PresidioEngine(),
        ScrubadubEngine(),
        GcpDlpEngine(),
        AwsComprehendEngine(),
    ]
}

DEFAULT_ENGINE = "presidio"


def list_engines() -> list[EngineInfo]:
    return [e.info() for e in _ENGINES.values()]


def get_engine(name: str) -> PiiEngine:
    if name not in _ENGINES:
        raise KeyError(f"Unbekannte Engine '{name}'. Verfügbar: {list(_ENGINES)}")
    return _ENGINES[name]


__all__ = [
    "DEFAULT_ENGINE",
    "EngineInfo",
    "PiiEngine",
    "PiiFinding",
    "get_engine",
    "list_engines",
]
