/* zengtrade crypto-only bootstrap — loaded before app.js.
 * Pins the terminal to Algo Studio + crypto market; removes Indian/Kite surfaces. */
(function () {
  'use strict';
  window.ZENG_CRYPTO_ONLY = true;

  try {
    var K = 'tradepro.terminal.v1';
    var st = JSON.parse(localStorage.getItem(K) || 'null') || {};
    st.persona = 'algo';
    st.algo = st.algo || {};
    st.algo.market = 'crypto';
    st.algo.view = st.algo.view || 'monitor';
    st.algo.exec = st.algo.exec || 'paper';
    localStorage.setItem(K, JSON.stringify(st));
  } catch (e) { /* ignore */ }

  document.documentElement.dataset.product = 'crypto';
})();
