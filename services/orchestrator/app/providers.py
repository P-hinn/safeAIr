"""LLM-Provider-Adapter: Ollama (lokal), OpenAI, Anthropic."""

import os

import httpx

TIMEOUT = 120.0


def _ollama_url() -> str:
    return os.environ.get("OLLAMA_URL", "").rstrip("/")


def provider_infos() -> list[dict]:
    infos = []
    # Ollama
    ollama_models: list[str] = []
    ollama_ready = False
    if _ollama_url():
        try:
            r = httpx.get(f"{_ollama_url()}/api/tags", timeout=5.0)
            r.raise_for_status()
            ollama_models = [m["name"] for m in r.json().get("models", [])]
            ollama_ready = True
        except httpx.HTTPError:
            pass
    infos.append(
        {
            "name": "ollama",
            "title": "Ollama (lokal)",
            "status": "ready" if ollama_ready else "not_configured",
            "detail": f"{len(ollama_models)} Modelle verfügbar" if ollama_ready else "OLLAMA_URL setzen bzw. Ollama starten (https://ollama.com).",
            "models": ollama_models,
        }
    )
    # OpenAI
    openai_key = bool(os.environ.get("OPENAI_API_KEY"))
    infos.append(
        {
            "name": "openai",
            "title": "OpenAI",
            "status": "ready" if openai_key else "not_configured",
            "detail": "API-Key gesetzt." if openai_key else "OPENAI_API_KEY in .env setzen.",
            "models": _remote_models("openai") if openai_key else [],
        }
    )
    # Anthropic
    anthropic_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    infos.append(
        {
            "name": "anthropic",
            "title": "Anthropic",
            "status": "ready" if anthropic_key else "not_configured",
            "detail": "API-Key gesetzt." if anthropic_key else "ANTHROPIC_API_KEY in .env setzen.",
            "models": _remote_models("anthropic") if anthropic_key else [],
        }
    )
    return infos


def _remote_models(provider: str) -> list[str]:
    try:
        if provider == "openai":
            r = httpx.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
                timeout=8.0,
            )
            r.raise_for_status()
            return sorted(
                m["id"] for m in r.json().get("data", []) if m["id"].startswith(("gpt-", "o"))
            )[:40]
        if provider == "anthropic":
            r = httpx.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": os.environ["ANTHROPIC_API_KEY"],
                    "anthropic-version": "2023-06-01",
                },
                timeout=8.0,
            )
            r.raise_for_status()
            return [m["id"] for m in r.json().get("data", [])]
    except httpx.HTTPError:
        pass
    return []


def chat(provider: str, model: str, messages: list[dict]) -> str:
    """Führt einen Chat-Call aus. messages: [{role: user|assistant|system, content: str}]"""
    if provider == "ollama":
        if not _ollama_url():
            raise RuntimeError("Ollama nicht konfiguriert (OLLAMA_URL).")
        r = httpx.post(
            f"{_ollama_url()}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        return r.json().get("message", {}).get("content", "")

    if provider == "openai":
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY nicht gesetzt.")
        r = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": model, "messages": messages},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

    if provider == "anthropic":
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY nicht gesetzt.")
        system = "\n".join(m["content"] for m in messages if m["role"] == "system")
        chat_messages = [m for m in messages if m["role"] != "system"]
        payload: dict = {"model": model, "max_tokens": 2048, "messages": chat_messages}
        if system:
            payload["system"] = system
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
            json=payload,
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        return "".join(b.get("text", "") for b in r.json().get("content", []))

    raise RuntimeError(f"Unbekannter Provider '{provider}'.")
