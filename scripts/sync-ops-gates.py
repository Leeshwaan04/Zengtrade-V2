#!/usr/bin/env python3
"""Refresh gate snapshot in saas/web/ops-data.json from live probes."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPS_DATA = ROOT / "saas" / "web" / "ops-data.json"


def probe(script: str) -> bool:
    r = subprocess.run(
        [f"./scripts/{script}"],
        cwd=ROOT,
        capture_output=True,
        env={**os.environ, "SITE": "https://zengtrade.in"},
    )
    return r.returncode == 0


def worker_heartbeat() -> str | None:
    r = subprocess.run(
        [
            "curl",
            "-sfL",
            "https://ponvarxeytfcntckczbn.supabase.co/rest/v1/engine_state?key=eq._worker_heartbeat&select=updated_at",
            "-H",
            "apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1",
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        return None
    try:
        rows = json.loads(r.stdout)
        return rows[0]["updated_at"][:19] if rows else None
    except (json.JSONDecodeError, KeyError, IndexError):
        return None


def railway_status() -> dict:
    token = os.environ.get("RAILWAY_API_TOKEN") or os.environ.get("RAILWAY_TOKEN")
    if not token:
        return {}
    r = subprocess.run(
        ["./scripts/check-railway-deploy.sh"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        env={**os.environ, "RAILWAY_API_TOKEN": token},
    )
    text = (r.stdout or "").strip()
    line = next((ln for ln in text.split("\n") if "DATABASE_URL" in ln or "paper-worker" in ln), "")
    if not line and text:
        line = text.split("\n")[0]
    out: dict = {}
    if "DATABASE_URL missing" in line:
        out["railway_database_url_set"] = False
    elif "DATABASE_URL set" in line:
        out["railway_database_url_set"] = True
    if "FAILED" in line:
        out["railway_paper_worker"] = "FAILED"
    elif "SUCCESS" in line:
        out["railway_paper_worker"] = "SUCCESS"
    return out


def main() -> int:
    gates = {
        "production": probe("check-production.sh"),
        "billing": probe("verify-billing.sh"),
        "billing_ready": probe("check-billing-ready.sh"),
        "gsc_ready": probe("check-gsc-ready.sh"),
        "activation_ready": probe("check-activation-ready.sh"),
        "funnel_ctas": probe("check-funnel-ctas.sh"),
        "migration_0011": probe("check-migrations.sh"),
        "worker": probe("check-worker.sh"),
        "worker_heartbeat_utc": worker_heartbeat(),
        "all_p0_green": False,
    }
    gates.update(railway_status())
    gates["database_url_auth_ok"] = probe("validate-database-credentials.sh")
    if gates["worker"]:
        gates["parallel_growth_ready"] = True
    else:
        gates["parallel_growth_ready"] = (
            subprocess.run(
                ["./scripts/check-parallel-growth.sh"],
                cwd=ROOT,
                capture_output=True,
            ).returncode
            == 0
        )
    gates["all_p0_green"] = all(
        gates[k] for k in ("production", "billing", "migration_0011", "worker")
    )

    data = json.loads(OPS_DATA.read_text(encoding="utf-8"))
    data["updated"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )
    data["gates"] = gates
    OPS_DATA.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(gates, indent=2))
    return 0 if gates["all_p0_green"] else 1


if __name__ == "__main__":
    sys.exit(main())
