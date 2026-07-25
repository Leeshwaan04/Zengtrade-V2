/* Frontend headless smoke — zengtrade personal terminal (assets/app.js).
 *
 * Renders EVERY Algo Studio view in BOTH markets (Indian + Crypto) and asserts each one:
 *   1. does not throw
 *   2. returns non-trivial HTML
 *   3. fires no console.error / window error during render
 *   4. contains no EMPTY icon svgs  (the exact bug class that shipped 11 invisible icons)
 *   5. leaks no literal "undefined" / "NaN" into the DOM
 *
 * This is a RENDER smoke: it calls each view's render function directly, so it needs no
 * fragile click-navigation and stays green regardless of which top-level tab is open.
 *
 * Run it (browser must be serving the terminal on :8011, bot_api on :8756):
 *   agent-browser open http://127.0.0.1:8011/
 *   agent-browser eval "$(cat tests/smoke_frontend.js)"
 * A JSON summary prints; exit/interpret: pass === true means all views are clean.
 *
 * Or paste the whole file into the browser devtools console on the terminal tab.
 */
(async () => {
  const errs = [];
  const _ce = console.error;
  console.error = (...a) => { errs.push('console.error: ' + a.map(String).join(' ')); _ce.apply(console, a); };
  const _onerr = window.onerror;
  window.onerror = (m, s, l, c, e) => { errs.push('window.onerror: ' + m); return false; };

  // Best-effort: load the data each view reads, so we smoke the DATA path, not just empty states.
  const loaders = [
    ['loadBotData'], ['loadCrypto'], ['loadCryptoMonitor'], ['loadCryptoAn'], ['loadCryptoRisk'],
    ['loadCryptoFwd'], ['loadRisk'], ['loadPositions'],
    ['loadReadiness', 'in'], ['loadReadiness', 'crypto'], ['loadRegimeFit', 'in'], ['loadRegimeFit', 'crypto'],
  ];
  await Promise.allSettled(loaders.map(([fn, arg]) => {
    try { return (typeof window[fn] === 'function') ? Promise.resolve(window[fn](arg)) : null; }
    catch (e) { return null; }
  }));
  await new Promise(r => setTimeout(r, 1400));   // let the fetches settle

  // Match renderAlgo()'s state preconditions so we smoke the views, not missing-init crashes.
  state.algo = state.algo || {};
  state.algo.cinstr = state.algo.cinstr || 'spot';
  state.algo.cbt = state.algo.cbt || { strat: 'macross', period: '1Y' };
  state.algo.bt = state.algo.bt || { algo: 0, period: '1Y' };
  state.algo.exec = state.algo.exec || 'paper';

  const VIEWS = ['monitor', 'library', 'positions', 'forward', 'accuracy', 'analytics', 'risk', 'backtest'];
  // Indian dispatch mirrors renderAlgo()'s body selection (kept in lockstep with app.js).
  const indian = {
    monitor: () => algoMonitor(), library: () => algoLibrary(), positions: () => algoPositions(),
    forward: () => algoForward(), accuracy: () => readinessView('in') + algoAccuracy(),
    analytics: () => algoAnalytics() + regimeFitMatrix('in'), risk: () => algoRisk(), backtest: () => algoBacktest(),
  };

  const EMPTY_ICON = /<svg class="ico"[^>]*>\s*<\/svg>/g;   // icon(name) with an unknown/missing glyph
  const results = [];
  for (const market of ['in', 'crypto']) {
    state.algo.market = market;
    for (const view of VIEWS) {
      state.algo.view = view;
      const before = errs.length;
      const row = { market, view, ok: true, len: 0, issues: [] };
      let html = '';
      try {
        html = market === 'crypto' ? cryptoBody(view, view) : indian[view]();
        html = String(html == null ? '' : html);
      } catch (e) {
        row.ok = false; row.issues.push('THREW: ' + (e && e.message || e));
      }
      row.len = html.length;
      if (row.ok && html.length < 40) row.issues.push('EMPTY: render returned <40 chars');
      const emptyIcons = (html.match(EMPTY_ICON) || []).length;
      if (emptyIcons) row.issues.push('EMPTY_ICONS: ' + emptyIcons + ' invisible icon(s)');
      if (/>\s*undefined\s*</.test(html) || /\bundefined%/.test(html)) row.issues.push('LEAK: "undefined" in DOM');
      if (/>\s*NaN\s*</.test(html)) row.issues.push('LEAK: "NaN" in DOM');
      const during = errs.slice(before);
      if (during.length) row.issues.push('ERRORS: ' + during.join(' | '));
      if (row.issues.length) row.ok = false;
      results.push(row);
    }
  }

  console.error = _ce; window.onerror = _onerr;
  const failed = results.filter(r => !r.ok);
  const summary = {
    pass: failed.length === 0,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed,
    grid: results.map(r => `${r.ok ? 'ok  ' : 'FAIL'} ${r.market}/${r.view} (${r.len}b)`),
  };
  return JSON.stringify(summary, null, 2);
})();
