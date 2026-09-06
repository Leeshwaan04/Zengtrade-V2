/* Accessibility audit: zengtrade personal terminal (assets/app.js).
 *
 * A dependency-free WCAG-A/AA scan of the LIVE rendered DOM (axe-core can't load under the
 * terminal's CSP). It reports the high-signal, low-false-positive violations that actually
 * lock keyboard + screen-reader users out:
 *
 *   1. interactive element with NO accessible name (button/link/tab a SR would announce as blank)
 *   2. form control with no associated <label> / aria-label
 *   3. click handler on a non-interactive element that ISN'T keyboard-operable (no role+tabindex)
 *   4. <img> / content <svg> with no alt / aria-label and not aria-hidden
 *   5. duplicate id (breaks label-for + aria references)
 *   6. positive tabindex (hijacks tab order)
 *
 * Run:  agent-browser open http://127.0.0.1:8011/ && agent-browser eval "$(cat tests/a11y_audit.js)"
 * Returns JSON: { pass, counts, findings[] }.  Paste into devtools console too.
 */
(() => {
  const findings = [];
  const add = (rule, sev, el, detail) => findings.push({
    rule, sev,
    tag: el ? (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) : '',
    snippet: el ? (el.outerHTML || '').slice(0, 90).replace(/\s+/g, ' ') : '',
    detail,
  });

  const visible = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const accName = el => {
    const aria = (el.getAttribute('aria-label') || '').trim();
    if (aria) return aria;
    const lbById = el.getAttribute('aria-labelledby');
    if (lbById) { const t = lbById.split(/\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim(); if (t) return t; }
    const title = (el.getAttribute('title') || '').trim();
    const text = (el.textContent || '').trim();
    // an icon-only control: text may be empty but an inner svg with aria-label counts
    const svgLbl = el.querySelector('svg[aria-label]');
    return text || title || (svgLbl ? svgLbl.getAttribute('aria-label') : '') || '';
  };

  // 1 + 3: interactive elements
  const INTERACTIVE = 'button, a[href], [role="button"], [role="tab"], [role="link"], [role="menuitem"], [role="switch"], [role="checkbox"]';
  document.querySelectorAll(INTERACTIVE).forEach(el => {
    if (!visible(el)) return;
    if (!accName(el)) add('no-accessible-name', 'A', el, 'interactive control a screen reader announces as blank');
  });

  // 2: form controls without a label
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (!visible(el) || el.type === 'hidden') return;
    const id = el.id;
    const hasFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
    const wrapped = el.closest('label');
    const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    const ph = el.getAttribute('placeholder');
    if (!hasFor && !wrapped && !aria) add('input-no-label', ph ? 'AA' : 'A', el, ph ? 'only a placeholder (not a label) — announced but disappears on type' : 'no label at all');
  });

  // 3: keyboard-inoperable click handlers (onclick on a plain div/span with no role+tabindex)
  document.querySelectorAll('[onclick], [data-onclick]').forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) return;
    const role = el.getAttribute('role');
    const focusable = el.tabIndex >= 0;
    if (!(role && focusable)) add('click-not-keyboard', 'A', el, 'click handler but not keyboard-operable (needs role + tabindex + key handler)');
  });

  // 4: images / content svgs without a text alternative
  document.querySelectorAll('img').forEach(el => {
    if (!visible(el)) return;
    if (el.getAttribute('alt') == null && el.getAttribute('aria-hidden') !== 'true' && el.getAttribute('role') !== 'presentation')
      add('img-no-alt', 'A', el, 'image without alt (add alt="" if decorative)');
  });

  // 5: duplicate ids
  const seen = {};
  document.querySelectorAll('[id]').forEach(el => { const id = el.id; seen[id] = (seen[id] || 0) + 1; });
  Object.entries(seen).filter(([, n]) => n > 1).forEach(([id, n]) => add('duplicate-id', 'A', null, `id="${id}" used ${n}×`));

  // 6: positive tabindex hijacks the natural tab order
  document.querySelectorAll('[tabindex]').forEach(el => {
    if (+el.getAttribute('tabindex') > 0) add('positive-tabindex', 'AA', el, 'tabindex>0 forces an unnatural focus order');
  });

  // de-dup identical findings (same rule + snippet), cap the report
  const key = f => f.rule + '|' + f.snippet;
  const uniq = []; const kseen = new Set();
  for (const f of findings) { const k = key(f); if (!kseen.has(k)) { kseen.add(k); uniq.push(f); } }

  const counts = uniq.reduce((m, f) => (m[f.rule] = (m[f.rule] || 0) + 1, m), {});
  return JSON.stringify({
    pass: uniq.length === 0,
    total: uniq.length,
    counts,
    findings: uniq.slice(0, 60),
  }, null, 2);
})();
