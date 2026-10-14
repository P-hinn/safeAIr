"""In-Memory-Job-Runner für Red-Teaming-CLI-Läufe (Promptfoo, Garak).

Jobs laufen als Subprozess, Output landet in einer Logdatei unter /tmp.
Es werden ausschließlich vordefinierte Presets ausgeführt – freie CLI-Argumente
sind bewusst nicht erlaubt, weil beide Tools darüber beliebige Befehle oder
Dateischreibzugriffe auslösen könnten.

Für Produktion: persistente Job-Queue (z. B. Redis + Worker) vorsehen.
"""

import importlib.util
import re
import shutil
import subprocess
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

LOG_DIR = Path("/tmp/safair-redteam")
LOG_DIR.mkdir(parents=True, exist_ok=True)

MAX_RUNNING_JOBS = 2
MAX_STORED_JOBS = 50

TOOLS: dict[str, list[str]] = {
    "promptfoo": ["promptfoo"],
    "garak": ["python", "-m", "garak"],
}

_MODEL_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$")
_PROBE_PATTERN = re.compile(r"^[a-z0-9_]+(\.[A-Za-z0-9_]+)?$")


@dataclass(frozen=True)
class Preset:
    tool: str
    title: str
    args: tuple[str, ...]
    needs_target: bool = False


PRESETS: dict[str, Preset] = {
    "promptfoo-version": Preset("promptfoo", "Promptfoo-Version anzeigen", ("--version",)),
    "promptfoo-redteam-plugins": Preset("promptfoo", "Verfügbare Red-Team-Plugins auflisten", ("redteam", "plugins")),
    "garak-version": Preset("garak", "Garak-Version anzeigen", ("--version",)),
    "garak-list-probes": Preset("garak", "Verfügbare Probes auflisten", ("--list_probes",)),
    "garak-probe": Preset("garak", "Probe gegen ein OpenAI-Modell ausführen", (), needs_target=True),
}


class ScanLimitError(RuntimeError):
    pass


def tool_available(tool: str) -> bool:
    if tool == "promptfoo":
        return shutil.which("promptfoo") is not None
    if tool == "garak":
        return importlib.util.find_spec("garak") is not None
    return False


def build_args(preset_name: str, model: str | None = None, probe: str | None = None) -> list[str]:
    preset = PRESETS.get(preset_name)
    if preset is None:
        raise ValueError(f"Unbekanntes Preset '{preset_name}'. Erlaubt: {list(PRESETS)}")
    if not preset.needs_target:
        return list(preset.args)
    if not model or not _MODEL_PATTERN.match(model):
        raise ValueError("Preset benötigt einen gültigen Modellnamen ('model').")
    if not probe or not _PROBE_PATTERN.match(probe):
        raise ValueError("Preset benötigt einen gültigen Probe-Namen ('probe'), z. B. 'dan'.")
    return ["--model_type", "openai", "--model_name", model, "--probes", probe]


@dataclass
class Job:
    id: str
    tool: str
    preset: str
    args: list[str]
    started_at: str
    process: subprocess.Popen
    log_file: Path

    @property
    def status(self) -> str:
        code = self.process.poll()
        if code is None:
            return "running"
        return "completed" if code == 0 else "failed"


_JOBS: dict[str, Job] = {}


def _prune_jobs() -> None:
    finished = [j for j in list_jobs() if j.status != "running"]
    for job in finished[MAX_STORED_JOBS:]:
        job.log_file.unlink(missing_ok=True)
        _JOBS.pop(job.id, None)


def start_job(preset_name: str, model: str | None = None, probe: str | None = None) -> Job:
    args = build_args(preset_name, model, probe)
    tool = PRESETS[preset_name].tool
    if not tool_available(tool):
        raise RuntimeError(f"Tool '{tool}' ist im Image nicht installiert.")
    if sum(1 for j in _JOBS.values() if j.status == "running") >= MAX_RUNNING_JOBS:
        raise ScanLimitError(f"Es laufen bereits {MAX_RUNNING_JOBS} Scans. Bitte später erneut versuchen.")

    job_id = uuid.uuid4().hex[:12]
    log_file = LOG_DIR / f"{job_id}.log"
    with open(log_file, "w") as log:
        process = subprocess.Popen(TOOLS[tool] + args, stdout=log, stderr=subprocess.STDOUT, cwd=str(LOG_DIR))

    job = Job(
        id=job_id,
        tool=tool,
        preset=preset_name,
        args=args,
        started_at=datetime.now(timezone.utc).isoformat(),
        process=process,
        log_file=log_file,
    )
    _JOBS[job_id] = job
    _prune_jobs()
    return job


def get_job(job_id: str) -> Job | None:
    return _JOBS.get(job_id)


def list_jobs() -> list[Job]:
    return sorted(_JOBS.values(), key=lambda j: j.started_at, reverse=True)


def job_log_tail(job: Job, lines: int = 100) -> str:
    if not job.log_file.exists():
        return ""
    content = job.log_file.read_text(errors="replace").splitlines()
    return "\n".join(content[-lines:])
