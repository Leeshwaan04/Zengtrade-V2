---
slug: how-to-create-a-binance-api-key
title: How to Create a Binance API Key for zengtrade
description: A step-by-step walkthrough for creating a trade-only Binance API key, the exact permissions to check and skip, and what to do if something looks wrong.
date: 2026-09-20
---
This is the exact walkthrough for the one thing zengtrade needs from you to place real orders: a **trade-only** Binance API key. It takes about two minutes. See [is zengtrade custodial?](/learn/is-zengtrade-custodial/) for why this key never lets zengtrade touch your funds, even in principle.

## Before you start

You'll need an existing Binance account with two-factor authentication (2FA) turned on. Binance requires 2FA before it will let you create an API key at all, so if you haven't set it up yet, do that first from your Binance security settings.

## Step by step

1. **Go to [binance.com](https://www.binance.com) and log in.**
2. **Open API Management.** Click your profile icon in the top right, then **Account**, then **API Management**.
3. **Create a new key.** Click **Create API**, choose the standard system-generated key, and give it a label you'll recognize later, e.g. "zengtrade".
4. **Complete the security check.** Binance will ask for an email code and/or your 2FA code to confirm it's really you.
5. **Set permissions, carefully.** This is the only step that matters for your safety. Check **only** "Enable Spot & Margin Trading", and leave everything else, including **"Enable Withdrawals"**, unchecked. zengtrade never needs withdrawal access, and a key without it can place and manage orders but can never move funds out of your account, even if the key itself were somehow exposed.
6. **IP restriction (optional).** If you know how to restrict the key to a specific IP address, you can, but it isn't required to connect zengtrade. One honest trade-off worth knowing: Binance treats a key with no IP restriction as lower-trust and may periodically ask you to renew it. If that happens, just repeat this walkthrough for a fresh key.
7. **Copy both values now.** Binance shows your **API Key** and **Secret Key** together, once. The secret will not be shown again after you close that window, so copy both before doing anything else.
8. **Paste them into zengtrade.** Back in zengtrade, paste the API key and secret into the Connect Binance form and confirm. That's it, your account is connected.

## What this key can and can't do

**Can:** place and manage orders on your own Binance account, exactly the trades you make in zengtrade's Trading mode.

**Can't:** withdraw or transfer funds, change your Binance password or account settings, or access your identity or account documents. None of that is possible without the withdrawal permission you left unchecked in step 5.

## If you want to undo this

Disconnecting inside zengtrade (Account settings, or the header's exchange chip) removes the key from zengtrade's side. If you want to fully revoke it, delete the key directly from Binance's own API Management page, that takes effect immediately and doesn't require anything from zengtrade at all.
