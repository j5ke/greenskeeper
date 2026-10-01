/* Optional cookieless measurement. No collector loads until a site script is configured. */
(() => {
  'use strict';
  const host = location.hostname.replace(/^www\./, '');
  const source = document.querySelector('meta[name="plausible-script"]')?.content;
  if (!source || !/^https:\/\/plausible\.io\/js\/pa-[A-Za-z0-9_-]+\.js$/.test(source)) return;
  if (!['getgreenskeeper.com', 'www.getgreenskeeper.com', 'swingalysis.com', 'www.swingalysis.com'].includes(location.hostname)) return;
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  try { if (localStorage.getItem('greenskeeper:analytics-opt-out') === 'true') return; } catch { /* Storage is optional. */ }
  if (window.__gkAnalyticsLoaded) return;
  window.__gkAnalyticsLoaded = true;
  const plausible = window.plausible = window.plausible || function () { (plausible.q = plausible.q || []).push(arguments); };
  plausible.init = plausible.init || function (options) { plausible.o = options || {}; };
  plausible.init({
    autoCapturePageviews: true,
    outboundLinks: false,
    fileDownloads: false,
    formSubmissions: false,
    transformRequest(payload) {
      // Retain campaign attribution, never arbitrary query strings, fragments, or referrer paths.
      const url = new URL(payload.u || location.href);
      const allowed = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'source', 'ref']);
      for (const key of [...url.searchParams.keys()]) {
        if (!allowed.has(key) || !/^[a-z0-9_. -]{1,100}$/i.test(url.searchParams.get(key))) url.searchParams.delete(key);
      }
      url.hash = '';
      let referrer = '';
      try { referrer = new URL(payload.r).origin; } catch { /* No referrer. */ }
      return { ...payload, u: url.href, r: referrer };
    }
  });
  const script = document.createElement('script'); script.async = true; script.src = source; document.head.append(script);
  const tool = () => document.querySelector('[data-tool]')?.dataset.tool || (location.pathname === '/analyze' ? 'swingalysis' : 'website');
  const send = (event, extra = {}) => plausible(event, { props: { site: location.hostname.replace(/^www\./, ''), tool: tool(), ...extra } });
  const placement = (element) => element.closest('dialog') ? 'dialog' : element.closest('footer') ? 'footer' : element.closest('nav, .gk-family-bar') ? 'navigation' : element.closest('.tools-app-cta, .gk-story') ? 'app-section' : 'content';
  let engaged = false;
  document.addEventListener('input', (event) => {
    if (!engaged && event.isTrusted && event.target.closest('[data-tool], main[data-client-ready]')) { engaged = true; send('Tool engaged'); }
  });
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    let url; try { url = new URL(anchor.href, location.href); } catch { return; }
    const props = { placement: placement(anchor) };
    if (url.hostname === 'apps.apple.com' && url.pathname.includes('id6759922387')) send('App Store click', props);
    else if (url.hostname.replace(/^www\./, '') === 'swingalysis.com' && host !== 'swingalysis.com') send('Swingalysis click', props);
    else if (url.hostname.replace(/^www\./, '') === 'getgreenskeeper.com' && host !== 'getgreenskeeper.com') send('Greenskeeper click', props);
    else if (url.origin === location.origin && url.pathname === '/analyze') send('Analyzer open', { ...props, mode: url.searchParams.get('demo') === '1' ? 'demo' : 'video' });
  });
  window.addEventListener('greenskeeper:export-complete', () => send('Swing export completed'));
  window.addEventListener('greenskeeper:tool-export', (event) => {
    if (['calendar', 'trip-file', 'text', 'clipboard'].includes(event.detail)) send('Tool export completed', { format: event.detail });
  });
})();
