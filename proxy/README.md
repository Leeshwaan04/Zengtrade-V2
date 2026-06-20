# TradePro — Live Claude proxy

TradePro's AI Copilot can talk to a real Claude model (default **Opus 4.8**). Because
TradePro is a **static client-side app**, the browser must never hold your Anthropic
API key — so a tiny local proxy holds the key and relays requests.

## 1. Run the proxy

Requires Node 18+ (uses built-in `fetch`; no `npm install`).

```bash
export ANTHROPIC_API_KEY=sk-ant-...        # your key — stays on your machine
node proxy/claude-proxy.mjs                 # → http://localhost:8787/v1/messages
```

Optional env: `PORT` (default 8787), `ALLOW_ORIGIN` (default: any localhost origin).

## 2. Point the app at it

In TradePro, switch to **AI** mode → click the **⚙ settings** icon → set the endpoint to:

```
http://localhost:8787/v1/messages
```

Pick a model (Opus 4.8 / Sonnet 4.6 / Haiku 4.5), click **Test connection**, then **Save**.
The header badge flips from **Demo mode** to **Live · claude-opus-4-8** and replies now stream
from Claude. Clear the endpoint any time to return to the built-in scripted demo.

## How it works

- The app sends the chat history + a system prompt (app + portfolio context) to the proxy.
- The proxy adds your key + `anthropic-version` headers and forwards to `api.anthropic.com/v1/messages` with `stream: true`.
- The SSE response is piped straight back; the app renders `text_delta` chunks token-by-token.
- Claude may end a reply with `[[action:KEY]]`, which the app turns into a one-tap deep link into the relevant mode (option chain, strategy builder, research, etc.).

## Security notes

- **Key never reaches the browser.** It is read from `ANTHROPIC_API_KEY` and is never logged or returned.
- **CORS is localhost-only** by default — set `ALLOW_ORIGIN` to lock it to one origin if you expose it.
- The app **escapes all model output** before rendering, so a malformed/hostile stream can't inject HTML.
- This is a development helper. For production, run an authenticated server-side endpoint (rate-limited, per-user) rather than an open localhost proxy, and consider adaptive thinking / tool-use server-side.
