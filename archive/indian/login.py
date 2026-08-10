"""Run once per trading day to mint a Kite access_token.

    python login.py                 # interactive: paste the redirect URL or token
    python login.py "<url-or-token>" # non-interactive

You can paste EITHER the bare request_token OR the whole redirect URL
(https://127.0.0.1/?...request_token=XXXX...&action=login) — it extracts the
token for you. The token is written to .env as KITE_ACCESS_TOKEN.
"""
import sys
from urllib.parse import parse_qs, urlparse

from bot.config import load_env, require
from bot import auth


def extract_request_token(text: str) -> str:
    """Accept a bare token or a full redirect URL and return just the token."""
    text = text.strip().strip('"').strip("'")
    if "request_token=" in text:
        query = urlparse(text).query if "://" in text else text.split("?", 1)[-1]
        tokens = parse_qs(query).get("request_token")
        if tokens:
            return tokens[0]
        return text.split("request_token=", 1)[1].split("&", 1)[0]
    return text


def _write_env(key: str, value: str, path: str = ".env") -> None:
    lines, found = [], False
    try:
        with open(path) as f:
            for line in f:
                if line.startswith(f"{key}="):
                    lines.append(f"{key}={value}\n")
                    found = True
                else:
                    lines.append(line)
    except FileNotFoundError:
        pass
    if not found:
        lines.append(f"{key}={value}\n")
    with open(path, "w") as f:
        f.writelines(lines)


def main() -> None:
    load_env()
    api_key = require("KITE_API_KEY")
    api_secret = require("KITE_API_SECRET")

    if len(sys.argv) > 1:
        raw = sys.argv[1]
    else:
        print("\n1. Open this URL and log in:\n")
        print("   " + auth.login_url(api_key))
        print("\n2. After login you'll be redirected to a URL containing")
        print("   ?request_token=XXXX&action=login&status=success\n")
        raw = input("Paste the request_token OR the full redirect URL here: ")

    request_token = extract_request_token(raw)
    print(f"\nUsing request_token: {request_token}")
    access_token = auth.generate_access_token(api_key, api_secret, request_token)
    _write_env("KITE_ACCESS_TOKEN", access_token)
    print("✓ access_token saved to .env (valid until ~6am tomorrow).")


if __name__ == "__main__":
    main()
