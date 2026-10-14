/* Explicit anonymous PostHog capture API. No SDK, remote configuration or automatic capture. */
(() => {
  'use strict';
  if (window.GKAnalytics) return;
  const token = 'phc_oTQCPcyupbWWr6io3vqEhJwKTt6RLKVNYBxYvWvW95MN';
  const optKey = 'greenskeeper:analytics-opt-out';
  const idKey = 'greenskeeper:analytics-id';
  const tools = ['golf-trip-planner', 'golf-trip-budget-calculator', 'golf-daylight-calculator', 'golf-membership-calculator', 'golf-swing-analyzer'];
  const events = new Set(['$pageview', 'cta_clicked', 'tool_engaged', 'tool_action', 'form_submission', 'export_attempted', 'export_completed', 'export_failed', 'import_attempted', 'import_completed', 'import_failed', 'journal_used', 'print_requested']);
  const enums = {
    tool: [...tools, 'website'], placement: ['dialog', 'footer', 'navigation', 'content'],
    target: ['app-store', 'swingalysis', 'support', 'tools', 'journal', ...tools],
    action: ['activity-save', 'activity-edit', 'activity-remove', 'sample-load', 'reset', 'expense-add', 'expense-remove', 'trip-reuse', 'calculate', 'geolocation', 'search', 'filter'],
    outcome: ['attempt', 'success', 'failure'], format: ['calendar', 'trip-file', 'text', 'clipboard'],
  };
  let memoryOptOut = false, lastPath, distinctId;
  const verification = () => { try { return sessionStorage.getItem('greenskeeper:analytics-verification') === 'true'; } catch { return false; } };
  function allowed() {
    try {
      return location.protocol === 'https:' && ['getgreenskeeper.com', 'www.getgreenskeeper.com'].includes(location.hostname)
        && document.querySelector('meta[name="analytics-environment"]')?.content === 'production'
        && !memoryOptOut && !['true', '1'].includes(localStorage.getItem(optKey))
        && !['true', '1'].includes(localStorage.getItem('swingalysis:analytics-opt-out'))
        && localStorage.getItem('__ph_opt_in_out_' + token) !== '0' && localStorage.getItem('plausible_ignore') !== 'true'
        && !['1', 'yes'].includes(navigator.doNotTrack) && window.doNotTrack !== '1' && navigator.globalPrivacyControl !== true
        && (!navigator.webdriver || verification()) && !window.__GK_ACCEPTANCE_TEST__;
    } catch { return false; }
  }
  // Routes are supplied from the public artifact; arbitrary paths are never transmitted.
  const routes = new Set((document.querySelector('meta[name="analytics-routes"]')?.content || '').split(','));
  const path = () => location.pathname === '/index.html' || location.pathname === '/home.html' ? '/' : routes.has(location.pathname) ? location.pathname : '/other';
  function capture(event, props = {}) {
    try {
      if (!events.has(event) || !allowed()) return;
      if (!distinctId) {
        const stored = localStorage.getItem(idKey);
        distinctId = /^gk-[0-9a-f-]{36}$/.test(stored || '') ? stored : 'gk-' + crypto.randomUUID();
        localStorage.setItem(idKey, distinctId);
      }
      const pathname = path();
      const properties = { token, site: 'greenskeeper', environment: 'production', distinct_id: distinctId, $process_person_profile: false, $geoip_disable: true,
        $current_url: location.origin + pathname, $host: location.hostname, $pathname: pathname, verification_test: verification() };
      for (const [key, values] of Object.entries(enums)) if (values.includes(props[key])) properties[key] = props[key];
      properties.tool = tools.includes(document.querySelector('[data-tool]')?.dataset.tool) ? document.querySelector('[data-tool]').dataset.tool : 'website';
      try { const ref = new URL(document.referrer); if (['https:', 'http:'].includes(ref.protocol)) { properties.$referrer = ref.origin; properties.$referring_domain = ref.hostname; } } catch { /* Direct visit. */ }
      // text/plain avoids preflight, keepalive lets CTA navigation finish independently.
      void fetch('https://us.i.posthog.com/i/v0/e/', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
        body: JSON.stringify({ api_key: token, event, distinct_id: distinctId, properties }) }).catch(() => {});
    } catch { /* Analytics never blocks a website action. */ }
  }
  function pageview() { const current = path(); if (current !== lastPath && allowed()) { lastPath = current; capture('$pageview'); } }
  function setOptOut(value) {
    memoryOptOut = value;
    try { localStorage.setItem(optKey, String(value)); if (value) { localStorage.removeItem(idKey); distinctId = undefined; } } catch { /* Current-tab opt-out still works. */ }
    if (!value) pageview();
    updateControl();
  }
  function updateControl() {
    const status = document.querySelector('#analytics-status');
    if (status) status.textContent = allowed() ? 'Anonymous website analytics is enabled in this browser.' : 'Website analytics is off in this browser (your choice, privacy signal, or a non-production visit).';
  }
  window.GKAnalytics = { capture, setOptOut };
  document.querySelector('#analytics-disable')?.addEventListener('click', () => setOptOut(true));
  document.querySelector('#analytics-enable')?.addEventListener('click', () => setOptOut(false));
  updateControl(); pageview();
  window.addEventListener('popstate', pageview);
  window.addEventListener('pageshow', e => { if (e.persisted) { lastPath = undefined; pageview(); } });
  for (const method of ['pushState', 'replaceState']) { const original = history[method]; history[method] = function (...args) { const result = original.apply(this, args); pageview(); return result; }; }
  window.addEventListener('storage', updateControl);
  let engaged = false;
  document.addEventListener('input', e => { if (!engaged && e.isTrusted && e.target.closest('[data-tool]')) { engaged = true; capture('tool_engaged'); } });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (!a) return;
    let url; try { url = new URL(a.href, location.href); } catch { return; }
    const placement = a.closest('dialog') ? 'dialog' : a.closest('footer') ? 'footer' : a.closest('nav') ? 'navigation' : 'content';
    let target;
    if (url.hostname === 'apps.apple.com' && url.pathname.includes('id6759922387')) target = 'app-store';
    else if (['swingalysis.com', 'www.swingalysis.com'].includes(url.hostname)) target = 'swingalysis';
    else if (url.protocol === 'mailto:') target = 'support';
    else if (url.origin === location.origin) {
      if (url.pathname === '/tools/') target = 'tools';
      else if (url.pathname === '/blog/') target = 'journal';
      else if (url.pathname === '/support.html') target = 'support';
      else target = tools.find(t => url.pathname === '/tools/' + t + '/');
    }
    if (target) capture('cta_clicked', { target, placement });
  });
})();
