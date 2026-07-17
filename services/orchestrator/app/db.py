"""Policy-Store: SQLite (persistent via Docker-Volume unter /data)."""

import json
import os
import sqlite3
import uuid
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))

DEFAULT_POLICIES = [
    {
        "id": "standard",
        "name": "Standard",
        "builtin": True,
        "config": {
            "fail_closed": False,
            "language": "de",
            "pii_prompt": {"enabled": True, "engine": "presidio", "mode": "anonymize"},
            "guardrails_prompt": {"enabled": True, "engine": "heuristic", "action": "block"},
            "moderation_prompt": {"enabled": True, "action": "block"},
            "llm": {"provider": "ollama", "model": "llama3.2"},
            "guardrails_output": {"enabled": True, "engine": "heuristic", "action": "warn"},
            "moderation_output": {"enabled": False, "action": "warn"},
            "pii_output": {"enabled": False, "engine": "presidio", "mode": "anonymize"},
        },
    },
    {
        "id": "strikt",
        "name": "Strikt",
        "builtin": True,
        "config": {
            "fail_closed": True,
            "language": "de",
            "pii_prompt": {"enabled": True, "engine": "presidio", "mode": "anonymize"},
            "guardrails_prompt": {"enabled": True, "engine": "heuristic", "action": "block"},
            "moderation_prompt": {"enabled": True, "action": "block"},
            "llm": {"provider": "ollama", "model": "llama3.2"},
            "guardrails_output": {"enabled": True, "engine": "heuristic", "action": "block"},
            "moderation_output": {"enabled": True, "action": "block"},
            "pii_output": {"enabled": True, "engine": "presidio", "mode": "anonymize"},
        },
    },
    {
        "id": "nur-pii",
        "name": "Nur PII-Anonymisierung",
        "builtin": True,
        "config": {
            "fail_closed": False,
            "language": "de",
            "pii_prompt": {"enabled": True, "engine": "presidio", "mode": "anonymize"},
            "guardrails_prompt": {"enabled": False, "engine": "heuristic", "action": "warn"},
            "moderation_prompt": {"enabled": False, "action": "warn"},
            "llm": {"provider": "ollama", "model": "llama3.2"},
            "guardrails_output": {"enabled": False, "engine": "heuristic", "action": "warn"},
            "moderation_output": {"enabled": False, "action": "warn"},
            "pii_output": {"enabled": False, "engine": "presidio", "mode": "anonymize"},
        },
    },
    {
        "id": "passthrough",
        "name": "Passthrough (keine Checks)",
        "builtin": True,
        "config": {
            "fail_closed": False,
            "language": "de",
            "pii_prompt": {"enabled": False, "engine": "presidio", "mode": "anonymize"},
            "guardrails_prompt": {"enabled": False, "engine": "heuristic", "action": "warn"},
            "moderation_prompt": {"enabled": False, "action": "warn"},
            "llm": {"provider": "ollama", "model": "llama3.2"},
            "guardrails_output": {"enabled": False, "engine": "heuristic", "action": "warn"},
            "moderation_output": {"enabled": False, "action": "warn"},
            "pii_output": {"enabled": False, "engine": "presidio", "mode": "anonymize"},
        },
    },
]


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATA_DIR / "safair.db")
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS policies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                builtin INTEGER NOT NULL DEFAULT 0,
                config TEXT NOT NULL
            )"""
        )
        existing = {r["id"] for r in conn.execute("SELECT id FROM policies")}
        for p in DEFAULT_POLICIES:
            if p["id"] not in existing:
                conn.execute(
                    "INSERT INTO policies (id, name, builtin, config) VALUES (?, ?, ?, ?)",
                    (p["id"], p["name"], int(p["builtin"]), json.dumps(p["config"])),
                )


def _row_to_policy(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "builtin": bool(row["builtin"]),
        "config": json.loads(row["config"]),
    }


def list_policies() -> list[dict]:
    with _connect() as conn:
        return [_row_to_policy(r) for r in conn.execute("SELECT * FROM policies ORDER BY builtin DESC, name")]


def get_policy(policy_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM policies WHERE id = ?", (policy_id,)).fetchone()
        return _row_to_policy(row) if row else None


def save_policy(name: str, config: dict, policy_id: str | None = None) -> dict:
    policy_id = policy_id or uuid.uuid4().hex[:8]
    with _connect() as conn:
        row = conn.execute("SELECT builtin FROM policies WHERE id = ?", (policy_id,)).fetchone()
        builtin = bool(row["builtin"]) if row else False
        conn.execute(
            """INSERT INTO policies (id, name, builtin, config) VALUES (?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name, config = excluded.config""",
            (policy_id, name, int(builtin), json.dumps(config)),
        )
    return get_policy(policy_id)  # type: ignore[return-value]


def delete_policy(policy_id: str) -> bool:
    with _connect() as conn:
        row = conn.execute("SELECT builtin FROM policies WHERE id = ?", (policy_id,)).fetchone()
        if row is None or row["builtin"]:
            return False
        conn.execute("DELETE FROM policies WHERE id = ?", (policy_id,))
        return True
