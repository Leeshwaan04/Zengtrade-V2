#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Idempotent Cloud Agent install: Python deps for the trading terminal + bot API.
pip3 install --user -r backend/requirements.txt
