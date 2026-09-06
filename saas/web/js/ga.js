// zengtrade: GA4 event helper. The gtag.js loader tag itself lives directly in each page's
// <head> (it has to be a plain, synchronous-ish global script — it can't be an ES module import
// and still expose `window.gtag` before this module runs), so this file is only the thin,
// defensive wrapper every page's funnel calls import instead of touching `window.gtag` directly.
//
// Every call site already fires the SAME event into our own Supabase `event` table (see the
// admin funnel tiles) — these gtag calls are a second, parallel destination, not a replacement.
// GA4's own Enhanced Measurement already covers page_view/scroll/outbound_click automatically
// (enabled on the "zengtrade" web stream), so we only send the events Enhanced Measurement can't
// know about: our own funnel milestones and, server-side, completed payments (see
// saas/supabase/functions/nowpayments-ipn, which posts a `purchase` event via the Measurement
// Protocol using GA_MEASUREMENT_PROTOCOL_SECRET — that secret and this file are two different
// things; this file has no secret in it and can't, since it runs in the browser).

/** Fire a GA4 event. Never throws, never blocks the caller: analytics failing is not a reason
 * for a signup or a deploy to feel broken to the user. */
export function gaEvent(name, params) {
  try {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  } catch { /* analytics only */ }
}
