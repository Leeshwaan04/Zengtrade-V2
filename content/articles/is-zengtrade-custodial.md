---
slug: is-zengtrade-custodial
title: Is zengtrade Custodial?
description: zengtrade never holds your funds. Here's exactly what non-custodial means, how live execution works on your own exchange, and how to think about API-key safety.
date: 2026-09-07
---
**No. zengtrade is non-custodial.** It never holds, controls, or has withdrawal access to your funds, at any point - in paper mode or live. This page explains exactly what that means in practice, since "non-custodial" gets used loosely enough elsewhere that it's worth being precise about.

## What "custodial" actually means

A custodial platform holds your assets on your behalf - your funds sit in the platform's own accounts or wallets, and you trust the platform to manage, safeguard, and eventually let you withdraw them. Most centralized exchanges are custodial in exactly this sense. It's a real risk category: if a custodial platform is hacked, insolvent, or simply decides not to let you withdraw, your funds are exposed to that decision.

## How zengtrade avoids that entirely

**In paper mode** (the default for every account), there's nothing to custody in the first place - trades are simulated against live prices, no real funds are ever involved, and there is zero counterparty risk because there's no real capital in the loop.

**In live mode** (unlocked only once a strategy clears its paper track record), execution runs on **your own exchange account, using your own API keys**. zengtrade's engine sends orders to *your* exchange connection - it never takes possession of your assets, never has a withdrawal permission, and your funds never pass through zengtrade at any point. Your coins sit exactly where they've always sat: in your own exchange account, under your own control.

## What this means for API-key safety

Since live execution uses your own exchange API keys, key safety is worth understanding clearly:

- **Only grant trading permissions, never withdrawal permissions.** Every major exchange lets you scope an API key to trading only. A key without withdrawal rights can place and manage orders but cannot move funds out of your account, even if the key itself were somehow compromised.
- **zengtrade only needs what it needs.** It doesn't require, and shouldn't be given, a key with withdrawal access to function.
- **Your keys are yours to revoke at any time.** Since zengtrade never custodies funds, revoking a key from your exchange's own settings immediately and completely cuts off zengtrade's ability to trade on your behalf - there's no separate step required on zengtrade's side.

## Why this design, not a custodial one

A custodial design is often more convenient - one balance, one place to look, no exchange-key setup. It also concentrates risk: a platform holding many users' funds in one place is a bigger target, and a bigger single point of failure, than each user's funds sitting where they already were.

Non-custodial execution keeps that risk exactly where it already existed - between you and your own exchange - rather than adding a new layer of custody risk on top of it. It's a deliberate trade of some convenience for a real reduction in what could go wrong, and it's consistent with zengtrade's broader positioning: paper-first, honest about cost, and no promises it can't actually back up about where your money is at any given moment.
