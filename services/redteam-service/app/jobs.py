"""Einfacher In-Memory-Job-Runner für Red-Teaming-CLI-Läufe (Promptfoo, Garak).

MVP: Jobs laufen als Subprozess, Output landet in einer Logdatei unter /tmp.
Für Produktion: persistente Job-Queue (z. B. Redis + Worker) vorsehen.
"""

import shutil
import subprocess
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

LOG_DIR = Path("/tmp/safair-redteam")
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Erlaubte Tools -> Basis-Kommando
TOOLS: dict[str, list[str]] = {
    "promptfoo": ["promptfoo"],
    "garak": ["python", "-m", "garak"],
}


def tool_available(tool: str) -> bool:
    if tool == "promptfoo":
        return shutil.which("promptfoo") is not None
    if tool == "garak":
        import importlib.util

        return importlib.util.find_spec("garak") is not None
    return False


@dataclass
class Job:
    id: str
    tool: str
    args: list[str]
    started_at: str
    process: subprocess.Popen | None = None
    log_file: Path | None = None
    finished_at: str | None = None
    returncode: int | None = None
    extra: dict = field(default_factory=dict)

    @property
    def status(self) -> str:
        if self.process is None:
            return "error"
        code = self.process.poll()
        if code is None:
            return "running"
        return "completed" if code == 0 else "failed"


_JOBS: dict[str, Job] = {}


def start_job(tool: str, args: list[str]) -> Job:
    if tool not in TOOLS:
        raise ValueError(f"Unbekanntes Tool '{tool}'. Erlaubt: {list(TOOLS)}")
    if not tool_available(tool):
        raise RuntimeError(f"Tool '{tool}' ist im Image nicht installiert.")

    job_id = uuid.uuid4().hex[:12]
    log_file = LOG_DIR / f"{job_id}.log"
    cmd = TOOLS[tool] + args
    with open(log_file, "w") as log:
        process = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=str(LOG_DIR))

    job = Job(
        id=job_id,
        tool=tool,
        args=args,
        started_at=datetime.now(timezone.utc).isoformat(),
        process=process,
        log_file=log_file,
    )
    _JOBS[job_id] = job
    return job


def get_job(job_id: str) -> Job | None:
    return _JOBS.get(job_id)


def list_jobs() -> list[Job]:
    return sorted(_JOBS.values(), key=lambda j: j.started_at, reverse=True)


def job_log_tail(job: Job, lines: int = 100) -> str:
    if not job.log_file or not job.log_file.exists():
        return ""
    content = job.log_file.read_text(errors="replace").splitlines()
    return "\n".join(content[-lines:])
