"""Automated daily Kite login via TOTP — no manual paste.

Mints a fresh KITE_ACCESS_TOKEN headlessly, end to end:
    user_id + password  ->  TOTP 2FA  ->  request_token  ->  access_token  -> .env

Use it three ways:
  * scheduled (launchd / cron at ~6:10am) so the token is fresh before the open,
  * from start_paper.sh (refreshes before the harness starts),
  * on-demand — the dashboard self-heals by POSTing /api/relogin when it sees an
    expired token (bot_api imports mint_and_save()).

REQUIRES in .env (all git-ignored):
    KITE_API_KEY, KITE_API_SECRET     (already present)
    KITE_USER_ID      your Zerodha client id (e.g. AB1234)
    KITE_PASSWORD     your kite.zerodha.com password
    KITE_TOTP_SECRET  the base32 seed from Zerodha's external-TOTP (app 2FA) setup

SECURITY: this stores your FULL Zerodha login locally — keep .env git-ignored (it is)
and `chmod 600 .env`. Zerodha does not officially support automated login; this is a
widely-used community flow, used on your own account at your own discretion. It FAILS
SAFE: on any problem it returns a clear error and your manual `python3 login.py` still
works. No credential is ever logged.
"""
from __future__ import annotations

import os
import subprocess
import sys
from urllib.parse import urlparse, parse_qs

import requests

from bot.config import load_env
from login import _write_env   # reuse the same .env writer as the manual flow

LOGIN_URL = "https://kite.zerodha.com/api/login"
TWOFA_URL = "https://kite.zerodha.com/api/twofa"
REQUIRED = ("KITE_API_KEY", "KITE_API_SECRET", "KITE_USER_ID", "KITE_PASSWORD", "KITE_TOTP_SECRET")

# --- macOS Keychain (preferred secret store) -----------------------------------------------
# The login secrets live in the encrypted login Keychain, NOT plaintext .env — so they're not
# in the repo, not in git, not in folder backups, and unreadable from a stolen/cloned disk.
# Only these three (which ONLY auto_login uses) move to Keychain; KITE_API_KEY/SECRET stay in
# .env because the rest of the system reads them from there. cred() falls back to .env so the
# old plaintext setup keeps working unchanged.
KEYCHAIN_SERVICE = "tradepro-kite"
KEYCHAIN_KEYS = ("KITE_USER_ID", "KITE_PASSWORD", "KITE_TOTP_SECRET")


def _keychain_get(account: str):
    """Read a secret from the login Keychain (service=tradepro-kite). None if absent / non-mac."""
    try:
        r = subprocess.run(["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account, "-w"],
                           capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            return r.stdout.strip() or None
    except Exception:
        pass
    return None


def _keychain_set(account: str, value: str) -> bool:
    # -U updates if it exists; -A lets the bot/launchd read it non-interactively while you're
    # logged in (no prompt). Encrypted at rest + login-gated — far safer than plaintext .env.
    try:
        r = subprocess.run(["security", "add-generic-password", "-U", "-A",
                            "-s", KEYCHAIN_SERVICE, "-a", account, "-w", value],
                           capture_output=True, text=True, timeout=5)
        return r.returncode == 0
    except Exception:
        return False


def cred(key: str) -> str:
    """A credential's value: macOS Keychain first (preferred), then .env / environment."""
    return _keychain_get(key) or os.environ.get(key) or ""


def _capture_request_token(session: requests.Session, login_url: str) -> str:
    """Hit the Kite Connect login URL with the authenticated session and pull the
    request_token out of the redirect to the app's registered redirect URL — whether
    that URL is reachable (token in the final URL/history) or not (token in the
    unreachable redirect we tried to follow)."""
    try:
        r = session.get(login_url, allow_redirects=True, timeout=12)
        for u in [r.url] + [h.headers.get("Location", "") for h in r.history]:
            q = parse_qs(urlparse(u).query)
            if "request_token" in q:
                return q["request_token"][0]
    except requests.exceptions.ConnectionError as e:
        u = getattr(getattr(e, "request", None), "url", "") or ""
        q = parse_qs(urlparse(u).query)
        if "request_token" in q:
            return q["request_token"][0]
    raise RuntimeError("could not capture request_token "
                       "(check api_key, the app's redirect URL, and that the app is active)")


def mint_access_token(api_key, api_secret, user_id, password, totp_secret) -> str:
    """Run the full headless flow and return a fresh access_token (does not write anything)."""
    import pyotp                       # imported here so a missing dep degrades to a clear message
    from kiteconnect import KiteConnect

    s = requests.Session()
    r1 = s.post(LOGIN_URL, data={"user_id": user_id, "password": password}, timeout=12)
    j1 = r1.json() if r1.headers.get("content-type", "").startswith("application/json") else {}
    request_id = (j1.get("data") or {}).get("request_id")
    if r1.status_code != 200 or not request_id:
        raise RuntimeError(f"login (password) failed: {j1.get('message') or r1.text[:120]}")

    otp = pyotp.TOTP(totp_secret).now()
    r2 = s.post(TWOFA_URL, data={"user_id": user_id, "request_id": request_id,
                                 "twofa_value": otp, "twofa_type": "totp", "skip_session": ""}, timeout=12)
    j2 = r2.json() if r2.headers.get("content-type", "").startswith("application/json") else {}
    if r2.status_code != 200 or j2.get("status") != "success":
        raise RuntimeError(f"2FA (TOTP) failed: {j2.get('message') or r2.text[:120]}")

    kite = KiteConnect(api_key=api_key)
    request_token = _capture_request_token(s, kite.login_url())
    return kite.generate_session(request_token, api_secret=api_secret)["access_token"]


def mint_and_save(path: str = ".env") -> dict:
    """Resolve creds (Keychain → .env), mint a token, and persist it. Returns a status dict.
    CRUCIAL: also sets os.environ so the CURRENT process picks up the new token —
    bot.config.load_env() uses setdefault and would otherwise keep the stale one."""
    load_env(path)
    vals = {k: cred(k) for k in REQUIRED}
    missing = [k for k, v in vals.items() if not v]
    if missing:
        return {"ok": False, "error": "missing " + ", ".join(missing), "missing": missing}
    try:
        import pyotp  # noqa: F401
    except Exception:
        return {"ok": False, "error": "pyotp not installed — run: pip3 install pyotp"}
    try:
        token = mint_access_token(vals["KITE_API_KEY"], vals["KITE_API_SECRET"],
                                  vals["KITE_USER_ID"], vals["KITE_PASSWORD"], vals["KITE_TOTP_SECRET"])
    except Exception as e:
        return {"ok": False, "error": str(e)[:180]}
    _write_env("KITE_ACCESS_TOKEN", token, path)
    os.environ["KITE_ACCESS_TOKEN"] = token       # live process uses it immediately
    src = "keychain" if _keychain_get("KITE_PASSWORD") else "env"
    return {"ok": True, "tokenLen": len(token), "source": src}


def has_creds(path: str = ".env") -> bool:
    """True only if every auto-login credential resolves (Keychain or .env) — gate for self-heal."""
    load_env(path)
    return all(cred(k) for k in REQUIRED)


def setup_keychain() -> None:
    """Interactive one-time setup: store the 3 login secrets in the macOS Keychain.
    Input is hidden (getpass); nothing is written to .env or shell history."""
    import getpass
    if sys.platform != "darwin":
        print("Keychain setup is macOS-only. On other OSes, put the creds in .env instead.")
        return
    print("Storing your Kite login in the macOS Keychain (service: tradepro-kite).")
    print("Encrypted at rest, login-gated, never in the repo or backups. Blank = skip.\n")
    fields = [("KITE_USER_ID", "Zerodha client id (e.g. AB1234)", False),
              ("KITE_PASSWORD", "kite.zerodha.com password", True),
              ("KITE_TOTP_SECRET", "external-TOTP base32 seed", True)]
    stored = []
    for key, label, secret in fields:
        v = (getpass.getpass(f"  {label}: ") if secret else input(f"  {label}: ")).strip()
        if not v:
            continue
        if _keychain_set(key, v):
            stored.append(key)
        else:
            print(f"  ! failed to store {key}")
    if stored:
        print(f"\n✓ Stored in Keychain: {', '.join(stored)}")
        print("  Now DELETE those lines from .env (they're no longer needed there).")
        print("  Test it:  python3 auto_login.py")
    else:
        print("\nNothing stored.")


def clear_keychain() -> None:
    for key in KEYCHAIN_KEYS:
        subprocess.run(["security", "delete-generic-password", "-s", KEYCHAIN_SERVICE, "-a", key],
                       capture_output=True, text=True)
    print("✓ Removed Kite login secrets from the Keychain.")


def main() -> None:
    if "--setup" in sys.argv:
        return setup_keychain()
    if "--clear" in sys.argv:
        return clear_keychain()
    res = mint_and_save()
    if not res.get("ok"):
        print("✗ auto-login not done:", res.get("error"))
        if res.get("missing"):
            print("  Set up your login secrets (preferred — macOS Keychain):  python3 auto_login.py --setup")
            print("  …or add to .env:", ", ".join(res["missing"]))
            print("  And enable external TOTP on Zerodha (Console → Settings).")
        print("  Your manual fallback always works:  python3 login.py")
        sys.exit(1)
    # confirm it actually works
    try:
        from bot import auth
        name = auth.make_kite(cred("KITE_API_KEY"), os.environ["KITE_ACCESS_TOKEN"]).profile().get("user_name")
        print(f"✓ auto-login OK — {name} (creds from {res.get('source')}). "
              f"Fresh access_token saved to .env (valid until ~6am tomorrow).")
    except Exception as e:
        print("✓ token minted & saved, but verification call failed:", str(e)[:100])


if __name__ == "__main__":
    main()
