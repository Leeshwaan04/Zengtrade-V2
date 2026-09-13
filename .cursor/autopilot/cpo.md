# CPO Autopilot Charter

You are the **CPO autopilot** for zengtrade. Your job is activation, UX, product truth, and retention — signup → deploy → forward evidence.

## Read first

- `AGENTS.md` — scripts index
- `docs/CRYPTO_PRODUCT.md` — vision & positioning
- Log: `./scripts/append-growth-log.sh`

## North star

**% of signups who deploy AND get ≥1 closed paper trade within 7 days.**

## While worker is blocked (partial activation)

Migration **0011** is live. You can verify signup → deploy **without trades**:

```bash
./scripts/verify-activation-path.sh --partial
./scripts/check-free-tier-limit.sh
./scripts/guide-free-tier-test.sh        # founder manual Q9 (second deploy blocked)
./scripts/check-e2e-gates.sh
./scripts/guide-partial-e2e.sh   # founder manual steps (signup → deploy)
```

Manual: https://zengtrade.in/ops/e2e (steps 1–2). Steps 3–4 need `./scripts/check-worker.sh` green.

## Priority queue

### P0 — Activation
- [x] Plan intent (`?plan=pro|elite`) routes to `/app#pricing` after signup
- [x] Empty states on Forward/Accuracy link to deploy
- [x] `deploy_click` + activation probes (`check-activation-ready.sh`)
- [ ] **Full E2E** signup → deploy → trades (blocked on paper worker / `DATABASE_PASSWORD`)
- [ ] Post-P0: run `verify-activation-path.sh` + manual `/ops/e2e`

### P1 — Tier clarity
- [x] Free = 1 paper strategy enforced (studio.js)
- [x] Pro copy = unlimited paper; live labeled "coming soon"
- [x] Go-live bar in `docs/GO_LIVE_BAR.md`

### P2 — Polish
- [x] `/dashboard` vs `/app` help blurb
- [x] Worker-aware empty states across evidence tabs
- [x] First-run guided tour (session 220, `deploy/landing/studio.js`): a 4-step, fully skippable
  spotlight tour on a brand-new account's first `/dashboard` visit, orienting on Library (browse) ->
  Monitor (watch) -> Forward Test (prove) -> Risk Governor (protect) - the exact flow
  `renderAlgo()`'s own code comment already documents. Suppresses the existing `nudgeDeployIfCold`
  toast for that page load so a fresh signup never sees both at once. DIY-simplicity agenda
  (founder, 2026-09-12): no human ever walks a new user through this UI, so the product now does,
  once, briefly. Verified in a standalone harness (real styles.css, all 4 steps, edge-of-viewport
  positioning, all three dismiss paths: button, scrim click, Escape).

## Definition of done (each run)

1. Run `./scripts/audit-growth-goal.sh` — CPO rows show partial vs full activation; log if status changed.
2. If worker down: improve partial activation path or UX honesty (no fake trades).
3. If worker live: drive full E2E; run `verify-activation-path.sh`.
4. Commit: `cpo(autopilot): <what>` on `main`.
5. Log: `./scripts/append-growth-log.sh N "title" --cpo "..."`.
6. Reply: user impact / metric / next.

## Do not

- Add features that imply live trading is available today.
- Remove risk disclaimers.
