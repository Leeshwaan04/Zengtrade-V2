"""Tiny .env loader so we don't add a dependency. Secrets live in `.env`
(git-ignored); strategy/risk knobs live in the project-root `settings.py`.
"""
from __future__ import annotations

import os


def load_env(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise SystemExit(
            f"Missing {key}. Set it in .env (copy .env.example) or your shell."
        )
    return val
