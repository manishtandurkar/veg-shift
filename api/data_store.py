from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any, Dict


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "output" / "frontend_payload.json"

_payload_cache: Dict[str, Any] | None = None
_lock = Lock()


def load_payload() -> Dict[str, Any]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Frontend payload not found at {DATA_PATH}. Run tools/build_frontend_payload.py first."
        )
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def get_payload() -> Dict[str, Any]:
    global _payload_cache
    if _payload_cache is None:
        with _lock:
            if _payload_cache is None:
                _payload_cache = load_payload()
    return _payload_cache


def reload_payload() -> Dict[str, Any]:
    global _payload_cache
    with _lock:
        _payload_cache = load_payload()
    return _payload_cache
