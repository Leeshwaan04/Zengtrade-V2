# Hands-free daily Kite login

Zerodha Kite Connect access tokens expire **every day at ~06:00 IST** (a SEBI requirement —
there's no long-lived/refresh token for retail). This kills the bot + dashboard each morning
until you re-login. `auto_login.py` mints the fresh token for you, headlessly, via TOTP.

```
user_id + password  →  TOTP 2FA  →  request_token  →  access_token  →  .env
```

It runs three ways, so you never think about it:

| Trigger | What happens |
|---|---|
| **Scheduled** (launchd, 06:10 IST) | Token is fresh before the market opens — fully hands-free. |
| **`start_paper.sh`** | Refreshes the token before the paper harness starts. |
| **Dashboard self-heal** | The terminal detects the expired token and auto-reconnects within ~30s; a **Reconnect** button is the manual fallback. |

---

## One-time setup (~5 min)

1. **Enable External TOTP on Zerodha** (app-based 2FA): Kite → Console → *Settings → Account →
   enable external TOTP*. Scan/save the **base32 secret** it shows (that seed is what generates
   the 6-digit codes). *(SMS OTP can't be automated — you need the TOTP seed.)*

2. **Store your login secrets — preferred: macOS Keychain** (encrypted, never in the repo or
   backups, unreadable from a stolen disk):
   ```
   python3 auto_login.py --setup     # prompts for client id / password / TOTP seed (input hidden)
   ```
   The 3 secrets go into your login Keychain (service `tradepro-kite`); nothing is written to
   `.env`. `KITE_API_KEY`/`KITE_API_SECRET` stay in `.env` (the rest of the system reads them there).

   *Fallback (plaintext) if you'd rather:* put `KITE_USER_ID`, `KITE_PASSWORD`, `KITE_TOTP_SECRET`
   in `.env` and `chmod 600 .env`. `auto_login` reads Keychain first, then `.env`.
   To remove the Keychain secrets later: `python3 auto_login.py --clear`

3. **Install the TOTP lib:** `pip3 install pyotp`  (it's already in `requirements.txt`)

4. **Test it:** `python3 auto_login.py`  → should print `✓ auto-login OK — <your name>`

5. **Schedule it (optional but recommended):**
   ```
   cp com.tradepro.kite-login.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.tradepro.kite-login.plist
   launchctl start com.tradepro.kite-login      # run once now to confirm
   tail -f auto_login.log                        # watch the result
   ```

That's it. The token refreshes itself at 06:10 every morning and the dashboard self-heals if it
ever drops mid-day.

---

## Security — read this
- This handles your **full Zerodha login** — same trust level as your bank login. With the
  **Keychain** setup (the default) the secrets are **encrypted at rest, gated by your macOS login,
  and never touch the repo / git / folder backups** — so a synced backup, an accidental commit, a
  cloned disk, or a repo-reading dependency can't get them. The remaining exposure (any local app
  can read while you're logged in) is inherent to unattended automation and is the trade you accept
  for hands-free login. Everything stays on your machine (the bot API binds `127.0.0.1` only).
  *(If you use the `.env` fallback instead, `chmod 600 .env` — it's git-ignored but plaintext.)*
- **Zerodha does not officially support automated login** — they gate the daily 2FA on purpose.
  This is the widely-used community flow; use it on **your own account, at your discretion**.
- It **fails safe**: any problem (wrong password, TOTP drift, Zerodha changing endpoints) →
  a clear error, and your manual fallback always works:
  ```
  python3 login.py
  ```
- No credential is ever logged or sent anywhere except Zerodha's own login endpoints.

## How it self-heals (under the hood)
- `bot_api.py` detects the expired token (`/api/status` → `connected:false`) and, if the creds
  are present, mints a fresh one in the background (cooldown-guarded, ≤ once / 2 min).
- `POST /api/relogin` is the manual trigger behind the dashboard **Reconnect** button.
- After minting, it updates `os.environ` immediately (not just `.env`) so the running process
  picks up the new token without a restart. Long-running `paper_trade_all.py` / `run_bot.py`
  hold the token from startup, so let the 06:10 job (or `start_paper.sh`) refresh *before* they launch.
