"""Resolve NSE symbols -> 5paisa numeric ScripCodes.

Reads fivepaisa_scrips.json (pre-resolved from 5paisa's public scrip master).
To refresh/extend it, re-run scripts that download the scrip master CSV from
https://images.5paisa.com/website/scripmaster-csv-format.csv and filter
Exch='N', ExchType='C', Series='EQ'.
"""
from __future__ import annotations

import json
import os

_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fivepaisa_scrips.json")
_CACHE: dict[str, int] | None = None


def load_scrips() -> dict[str, int]:
    global _CACHE
    if _CACHE is None:
        with open(_PATH) as f:
            _CACHE = json.load(f)
    return _CACHE


def scrip_for(symbol: str) -> int:
    scrips = load_scrips()
    if symbol not in scrips:
        raise KeyError(f"No ScripCode for {symbol!r} in {_PATH}. Add it from the scrip master.")
    return scrips[symbol]
