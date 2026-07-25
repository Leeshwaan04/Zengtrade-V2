#!/usr/bin/env python3
"""SaaS Row-Level-Security isolation test — the P0 security gate for www.zengtrade.in.

The whole multi-tenant model rests on ONE guarantee: a user can only ever touch rows where
`user_id = auth.uid()`. If that leaks, one customer can read another's deployments, book and
trades. This test proves the guarantee against the LIVE Supabase project — no mocks.

Two tiers:

  TIER 1 — always runs, needs only the PUBLIC anon key. Proves RLS is ON and FAILS CLOSED:
     • the unauthenticated (anon) role SELECTs nothing from every protected table  → []
     • an anon INSERT is rejected by the RLS WITH CHECK                            → 42501

  TIER 2 — full cross-user isolation. Needs TWO already-confirmed test accounts (this project
     has email-confirmation ON, so users can't be minted here). Provide via env:
        ZT_RLS_A_EMAIL  ZT_RLS_A_PASS   ZT_RLS_B_EMAIL  ZT_RLS_B_PASS
     Then it: signs both in, has A insert a deployment, and proves B can NEITHER see nor
     delete it, and that each user sees ONLY their own rows. Cleans up after itself.
     If the env vars are absent it SKIPS (not fails) with instructions.

Run:  python3 saas/tests/rls_isolation.py
Exit: 0 = all ran checks passed (tier 2 may be skipped), 1 = a real isolation failure.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

try:
    import requests  # preferred: works behind cert-inspecting proxies where urllib fails
except ImportError:
    requests = None

SB = os.environ.get("ZT_SUPABASE_URL", "https://ponvarxeytfcntckczbn.supabase.co")
ANON = os.environ.get("ZT_SUPABASE_ANON", "sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1")
TABLES = ["profile", "subscription", "exchange_connection", "deployment", "book_state", "trade"]

results: list[tuple[bool, str, str]] = []


def check(ok: bool, name: str, detail: str = "") -> bool:
    results.append((bool(ok), name, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  — {detail}" if detail else ""))
    return bool(ok)


def req(method: str, path: str, token: str, body: dict | None = None, prefer: str | None = None):
    """One PostgREST/Auth call. Returns (status, parsed_json). Never raises on HTTP error.
    Uses requests when available (survives the cert-inspecting proxy); falls back to urllib."""
    url = SB + path
    headers = {"apikey": ANON, "Authorization": f"Bearer {token}"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    if requests is not None:
        try:
            resp = requests.request(method, url, headers=headers,
                                    data=json.dumps(body) if body is not None else None, timeout=15)
            try:
                return resp.status_code, (resp.json() if resp.text.strip() else {})
            except ValueError:
                return resp.status_code, {"raw": resp.text}
        except Exception as e:
            return 0, {"error": str(e)}
    # urllib fallback
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            raw = resp.read() or b"{}"
            return resp.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read() or b"{}"
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw.decode(errors="replace")}
    except Exception as e:
        return 0, {"error": str(e)}


def signin(email: str, password: str) -> str | None:
    st, d = req("POST", "/auth/v1/token?grant_type=password", ANON,
                {"email": email, "password": password})
    return d.get("access_token") if st == 200 else None


# ---------------------------------------------------------------- TIER 1 (public, always runs)
def tier1_anon_fails_closed() -> None:
    print("\nTIER 1 — RLS is ON and fails closed (anon / unauthenticated):")
    for t in TABLES:
        st, d = req("GET", f"/rest/v1/{t}?select=*&limit=5", ANON)
        empty = (st == 200 and isinstance(d, list) and len(d) == 0)
        check(empty, f"anon SELECT {t} returns no rows",
              f"status={st} rows={len(d) if isinstance(d, list) else '?'}")
    # anon INSERT must be rejected by the RLS WITH CHECK (Postgres error 42501)
    st, d = req("POST", "/rest/v1/deployment", ANON,
                {"user_id": "00000000-0000-0000-0000-000000000000", "strategy_key": "trend_follow"},
                prefer="return=representation")
    rejected = (st in (401, 403)) and (d.get("code") == "42501")
    check(rejected, "anon INSERT into deployment is RLS-rejected", f"status={st} code={d.get('code')}")


# ---------------------------------------------------------------- TIER 2 (cross-user isolation)
def tier2_cross_user() -> bool:
    a_email, a_pass = os.environ.get("ZT_RLS_A_EMAIL"), os.environ.get("ZT_RLS_A_PASS")
    b_email, b_pass = os.environ.get("ZT_RLS_B_EMAIL"), os.environ.get("ZT_RLS_B_PASS")
    if not (a_email and a_pass and b_email and b_pass):
        print("\nTIER 2 — SKIPPED (no test accounts). To run the full cross-user isolation proof,")
        print("  export ZT_RLS_A_EMAIL/ZT_RLS_A_PASS and ZT_RLS_B_EMAIL/ZT_RLS_B_PASS for two")
        print("  already-confirmed accounts in this Supabase project, then re-run.")
        return True  # skip is not a failure

    print("\nTIER 2 — cross-user isolation (two real accounts):")
    ta, tb = signin(a_email, a_pass), signin(b_email, b_pass)
    if not check(bool(ta), "user A signs in") or not check(bool(tb), "user B signs in"):
        return False
    ida = req("GET", "/auth/v1/user", ta)[1].get("id")
    idb = req("GET", "/auth/v1/user", tb)[1].get("id")
    check(ida and idb and ida != idb, "A and B are distinct users", f"A={ida} B={idb}")

    marker = "rlstest_trend_follow"
    # A inserts a deployment it owns
    st, d = req("POST", "/rest/v1/deployment", ta,
                {"user_id": ida, "strategy_key": marker}, prefer="return=representation")
    row = (d[0] if isinstance(d, list) and d else d)
    dep_id = row.get("id") if isinstance(row, dict) else None
    check(st in (200, 201) and dep_id, "A inserts its own deployment", f"status={st}")

    try:
        # B must NOT see A's row
        st, d = req("GET", f"/rest/v1/deployment?strategy_key=eq.{marker}", tb)
        check(st == 200 and d == [], "B CANNOT see A's deployment", f"B saw {len(d) if isinstance(d,list) else '?'} rows")
        # A sees exactly its own
        st, d = req("GET", f"/rest/v1/deployment?strategy_key=eq.{marker}", ta)
        check(st == 200 and isinstance(d, list) and len(d) == 1 and d[0].get("user_id") == ida,
              "A sees exactly its own deployment", f"A saw {len(d) if isinstance(d,list) else '?'} rows")
        # B cannot delete A's row (targeted delete affects zero rows under B's policy)
        st, d = req("DELETE", f"/rest/v1/deployment?id=eq.{dep_id}", tb, prefer="return=representation")
        check(st in (200, 204) and (d == [] or d == {}), "B CANNOT delete A's deployment",
              f"status={st} deleted={len(d) if isinstance(d,list) else 0}")
        # confirm A's row still there after B's delete attempt
        st, d = req("GET", f"/rest/v1/deployment?id=eq.{dep_id}", ta)
        check(st == 200 and isinstance(d, list) and len(d) == 1, "A's row survived B's delete attempt")
    finally:
        req("DELETE", f"/rest/v1/deployment?id=eq.{dep_id}", ta)  # A cleans up its own row
    return True


def main() -> int:
    print("=" * 64)
    print("  zengtrade SaaS — Row-Level-Security isolation (LIVE Supabase)")
    print("  project:", SB)
    print("=" * 64)
    tier1_anon_fails_closed()
    tier2_cross_user()
    passed = sum(1 for ok, _, _ in results if ok)
    total = len(results)
    print("\n" + "=" * 64)
    print(f"  {passed}/{total} checks passed")
    print("=" * 64)
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
