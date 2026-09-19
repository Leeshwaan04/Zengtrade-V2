/* zengtrade crypto-only bootstrap, loaded before app.js.
 * Pins the terminal to Algo Studio + crypto market; removes Indian/Kite surfaces. */
(function () {
  'use strict';
  window.ZENG_CRYPTO_ONLY = true;

  try {
    var K = 'tradepro.terminal.v1';
    var st = JSON.parse(localStorage.getItem(K) || 'null') || {};
    // BUG FIX (2026-09-19): this used to force persona back to 'algo' unconditionally on every
    // load, silently corrupting a real saved Investing/Trading choice back to Algo Studio the
    // moment app.js's init() next read it - CRYPTO_ONLY means "crypto market only," it never
    // meant "Algo Studio only." Leave persona alone; only the market/exec crypto defaults below
    // are actually this file's job.
    st.algo = st.algo || {};
    st.algo.market = 'crypto';
    st.algo.view = st.algo.view || 'monitor';
    st.algo.exec = st.algo.exec || 'paper';
    localStorage.setItem(K, JSON.stringify(st));
  } catch (e) { /* ignore */ }

  document.documentElement.dataset.product = 'crypto';
})();
