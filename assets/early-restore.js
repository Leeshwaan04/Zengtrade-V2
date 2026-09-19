/* zengtrade: restore theme/mode/regime attributes on <html> BEFORE first paint.
 *
 * BUG FIX (2026-09-19, founder report): "a flash of layouts" right after logging in and the
 * dashboard rendering. Root cause: data-persona (and data-surface, day/night) were only ever set
 * deep inside app.js's init(), well after the browser had already parsed and painted the full
 * page - every pane (old chart/watchlist/order-pad, every panel, AND the active mode's own view)
 * is visible by default until CSS attribute-selector rules like
 * html[data-persona="algo"] .pane-left{display:none} have something to match against. A fresh
 * full-page load (exactly what a Google OAuth redirect back to the dashboard is) makes this cold,
 * unmasked flash maximally visible.
 *
 * This must be a real external file, not an inline <script> block: the page's CSP is
 * script-src 'self' with no 'unsafe-inline', specifically to block injected inline scripts - an
 * inline fix here would be silently blocked by the very same protection. Loaded synchronously,
 * first in <head>, before any stylesheet or body content, so the attributes exist the instant
 * the browser is ready to paint.
 */
(function () {
  "use strict";
  var LS_KEY = "tradepro.terminal.v1";
  var html = document.documentElement;
  try {
    var s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (s) {
      if (["trader", "investor", "algo", "ai"].indexOf(s.persona) > -1) html.dataset.persona = s.persona;
      if (["bull", "neutral", "bear"].indexOf(s.regime) > -1) html.dataset.regime = s.regime;
      if (["day", "night"].indexOf(s.surface) > -1) html.dataset.surface = s.surface;
    }
  } catch (e) {}
  // crypto-only.js (which sets window.ZENG_CRYPTO_ONLY) loads at the end of body, after this
  // script - can't check it here. It always forces 'algo' in every real deployment anyway, so
  // default straight to that: a first-ever visit (no saved state yet) never flashes the old
  // 3-pane layout even for a moment.
  if (!html.dataset.persona) html.dataset.persona = "algo";
})();
