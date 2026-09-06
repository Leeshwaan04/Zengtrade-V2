# zengtrade: going live on zengtrade.in

Target shape:

| Host | What | Who serves it | Who can reach it |
|---|---|---|---|
| `zengtrade.in` | public landing page | Cloudflare Pages (or Hostinger) | everyone |
| `app.zengtrade.in` | **your private terminal** | your Mac, via Cloudflare Tunnel | **only you** (CF Access) |

The terminal is deliberately *not* public: the bot API has no auth of its own, holds your Kite
session, and can place real orders. Cloudflare Access is the gate. The tunnel dials **out**, so
no inbound port is ever opened and the bot keeps binding `127.0.0.1` only.

> **Your Mac must be awake + the bot running** for the terminal to work. That's inherent: the
> data and the paper engine live there. (System Settings → Battery → Prevent sleeping.)

---

## Step 1: Put the domain on Cloudflare (in Hostinger)

Cloudflare needs to run DNS for `zengtrade.in`.

1. Cloudflare dashboard → **Add a site** → `zengtrade.in` → Free plan.
2. Cloudflare gives you two nameservers, e.g. `xxx.ns.cloudflare.com`.
3. Hostinger hPanel → your domain → **DNS / Nameservers** → *Change nameservers* → paste Cloudflare's two.
4. Wait for propagation (minutes–hours). Cloudflare shows "Active" when done.

## Step 2: Install + authenticate the tunnel (on your Mac)

```bash
brew install cloudflared
cloudflared tunnel login          # opens a browser → pick zengtrade.in
cloudflared tunnel create zengtrade
```
That prints a **tunnel UUID** and writes `~/.cloudflared/<UUID>.json`.

## Step 3: Config

Copy this repo's `deploy/cloudflared-config.yml` to `~/.cloudflared/config.yml` and replace
`<TUNNEL-UUID>` with the UUID from step 2:

```bash
cp deploy/cloudflared-config.yml ~/.cloudflared/config.yml
# then edit the credentials-file line
```

## Step 4: 🔒 Lock it down BEFORE routing DNS

**Do this first.** Between routing DNS and setting the policy, the API would be open to the world.

Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** → *Add an application* → **Self-hosted**:

- Application domain: `app.zengtrade.in`
- Session duration: e.g. 1 month
- **Policy**: Action **Allow**, Include → **Emails** → *your email only*

Now only your authenticated login reaches the tunnel, the app **and** `/api/*`.

## Step 5: Route DNS to the tunnel

```bash
cloudflared tunnel route dns zengtrade app.zengtrade.in
```

## Step 6: Run it

```bash
# foreground (first run: watch the logs)
cloudflared tunnel run zengtrade

# once happy, run it as a background service so it survives reboots
sudo cloudflared service install
```

Make sure these are up on the Mac (they're already launchd jobs):
- `serve.py` on **:8011** (the frontend)
- `bot_api.py` on **:8756** (the bot)  → `com.tradepro.botapi`

## Step 7: Test

Open **https://app.zengtrade.in** → you should hit a Cloudflare login → then your terminal, with
live data. `BOT_API` resolves to `''` (same-origin) off-localhost, so the app calls
`https://app.zengtrade.in/api/*` and the tunnel routes it to `:8756`.

---

## Public landing (`zengtrade.in`)

Static, no credentials, no broker data. Either:
- **Cloudflare Pages** (recommended, free): connect a repo or drag-drop `deploy/landing/`.
- **Hostinger**: upload `deploy/landing/` to `public_html`. (If you keep Hostinger for the apex,
  leave its A record in Cloudflare DNS pointing at Hostinger's IP, proxied.)

---

## Daily reality check

- **Kite token expires ~6 AM daily.** Until TOTP auto-login is set up, you must re-login each
  morning or the terminal shows ", " for Indian data. (Crypto is Binance-direct and unaffected.)
- **Mac asleep = no terminal.** The tunnel and bot both die with it.
- `ALLOW_LIVE` stays **unset** → paper only. Don't arm it on a machine reachable from the
  internet until you're certain about the Access policy.

## Hardening worth doing later

- Drop the `https:` wildcard in the CSP `connect-src` (index.html) and list exact hosts: 
  this also closes the AI-endpoint exfiltration hole flagged in the audit.
- Add a shared-secret header check in `bot_api.py` as defence-in-depth behind CF Access.
- Service-Auth token if you ever want a non-browser client to hit `/api/*`.
