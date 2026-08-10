/* Frontend headless smoke — zengtrade Crypto Algo Studio.
 *
 * Renders every crypto Algo Studio view and asserts each one:
 *   1. does not throw
 *   2. returns non-trivial HTML
 *   3. fires no console.error / window error during render
 *   4. contains no EMPTY icon svgs
 *   5. leaks no literal "undefined" / "NaN" into the DOM
 *
 * Run (browser on :8011, crypto API on :8756):
 *   agent-browser open http://127.0.0.1:8011/
 *   agent-browser eval "$(cat tests/smoke_frontend.js)"
 */
(async () => {
  const errs = [];
  const _ce = console.error;
  console.error = (...a) => { errs.push('console.error: ' + a.map(String).join(' ')); _ce.apply(console, a); };
  const _onerr = window.onerror;
  window.onerror = (m, s, l, c, e) => { errs.push('window.error: ' + m); return false; };

  const loaders = [
    ['loadCrypto'], ['loadCryptoMonitor'], ['loadCryptoAn'], ['loadCryptoRisk'],
    ['loadCryptoFwd'], ['loadReadiness', 'crypto'], ['loadRegimeFit', 'crypto'],
  ];
  await Promise.allSettled(loaders.map(([fn, arg]) => {
    try { return (typeof window[fn] === 'function') ? Promise.resolve(window[fn](arg)) : null; }
    catch (e) { return null; }
  }));
  await new Promise(r => setTimeout(r, 1400));

  state.algo = state.algo || {};
  state.algo.market = 'crypto';
  state.algo.cinstr = state.algo.cinstr || 'spot';
  state.algo.cbt = state.algo.cbt || { strat: 'macross', period: '1Y' };
  state.algo.bt = state.algo.bt || { algo: 0, period: '1Y' };
  state.algo.exec = state.algo.exec || 'paper';

  const VIEWS = ['monitor', 'library', 'positions', 'forward', 'accuracy', 'analytics', 'risk', 'backtest'];
  const results = [];
  for (const view of VIEWS) {
    state.algo.view = view;
    const before = errs.length;
    const row = { view, ok: true, len: 0, issues: [] };
    let html = '';
    try {
      html = cryptoBody(view, view);
      html = String(html == null ? '' : html);
    } catch (e) {
      row.ok = false; row.issues.push('THREW: ' + (e && e.message || e));
    }
    row.len = html.length;
    if (row.ok && html.length < 40) row.issues.push('EMPTY: render returned <40 chars');
    const EMPTY_ICON = /<svg class="ico"[^>]*>\s*<\/svg>/g;
    const emptyIcons = (html.match(EMPTY_ICON) || []).length;
    if (emptyIcons) row.issues.push('EMPTY_ICONS: ' + emptyIcons);
    if (/>\s*undefined\s*</.test(html) || /\bundefined%/.test(html)) row.issues.push('LEAK: "undefined"');
    if (/>\s*NaN\s*</.test(html)) row.issues.push('LEAK: "NaN"');
    const during = errs.slice(before);
    if (during.length) row.issues.push('ERRORS: ' + during.join(' | '));
    if (row.issues.length) row.ok = false;
    results.push(row);
  }

  console.error = _ce; window.onerror = _onerr;
  const failed = results.filter(r => !r.ok);
  return JSON.stringify({
    pass: failed.length === 0,
    product: 'crypto',
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed,
    grid: results.map(r => `${r.ok ? 'ok  ' : 'FAIL'} crypto/${r.view} (${r.len}b)`),
  }, null, 2);
})();
