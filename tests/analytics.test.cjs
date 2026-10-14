const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('assets/analytics.js', 'utf8');
function fixture(options = {}) {
  const payloads = [], listeners = {}, data = new Map(Object.entries(options.storage || {}));
  const location = { protocol: 'https:', hostname: options.host || 'getgreenskeeper.com', pathname: '/tools/golf-trip-planner/', origin: 'https://getgreenskeeper.com', href: 'https://getgreenskeeper.com/tools/golf-trip-planner/?email=secret#notes' };
  const context = { URL, Set, crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
    fetch: (url, opts) => { payloads.push({ url, opts, ...JSON.parse(opts.body) }); return Promise.resolve({ ok: true }); },
    window: { addEventListener: (n, f) => { listeners[n] = f; }, __GK_ACCEPTANCE_TEST__: options.acceptance },
    history: { pushState: () => {}, replaceState: () => {} }, location,
    navigator: { doNotTrack: options.dnt, globalPrivacyControl: options.gpc, webdriver: options.webdriver },
    localStorage: { getItem: key => { if (options.blockedStorage) throw Error('denied'); return data.get(key); }, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) },
    sessionStorage: { getItem: () => options.verification ? 'true' : null },
    document: { referrer: 'https://example.com/private?name=secret',
      querySelector: selector => selector.includes('analytics-environment') ? { content: options.preview ? 'preview' : 'production' } : selector.includes('analytics-routes') ? { content: '/,/privacy.html,/tools/golf-trip-planner/' } : selector === '[data-tool]' ? { dataset: { tool: 'golf-trip-planner' } } : null,
      addEventListener: (n, f) => { listeners[n] = f; },
    },
  };
  vm.runInNewContext(source, context);
  return { ...context, payloads, listeners, data };
}
test('production gate excludes previews, localhost, acceptance, webdriver, opt-outs, privacy signals and unavailable storage', () => {
  for (const options of [{ host:'localhost' }, { host:'preview.vercel.app' }, { host:'swingalysis.com' }, { preview:true }, { acceptance:true }, { webdriver:true }, { blockedStorage:true }, { dnt:'1' }, { dnt:'yes' }, { gpc:true }, { storage:{'greenskeeper:analytics-opt-out':'true'} }, { storage:{'greenskeeper:analytics-opt-out':'1'} }, { storage:{'swingalysis:analytics-opt-out':'1'} }]) assert.equal(fixture(options).payloads.length, 0, JSON.stringify(options));
});
test('one initial pageview and navigation ignores query/hash-only changes and duplicate loading', () => {
  const ctx = fixture(); assert.equal(ctx.payloads.length, 1);
  ctx.history.replaceState({}, '', '?private=secret'); ctx.listeners.popstate();
  vm.runInNewContext(source, ctx); assert.equal(ctx.payloads.length, 1);
  ctx.location.pathname = '/privacy.html'; ctx.history.pushState(); assert.equal(ctx.payloads.length, 2);
  ctx.listeners.pageshow({ persisted:false }); assert.equal(ctx.payloads.length, 2);
});
test('rebuilds allowlisted payloads, keeps token and disables geo/profiles; never sends secrets', () => {
  const ctx = fixture(); ctx.window.GKAnalytics.capture('export_completed', { format:'calendar', token:'evil', site:'evil', filename:'secret', email:'secret', $current_url:'https://evil.test/secret' });
  ctx.window.GKAnalytics.capture('unknown', { format:'calendar' });
  assert.equal(ctx.payloads.length, 2);
  const p = ctx.payloads[1]; assert.equal(p.properties.token, p.api_key); assert.equal(p.properties.site, 'greenskeeper');
  assert.equal(p.properties.$geoip_disable, true); assert.equal(p.properties.$process_person_profile, false);
  assert.equal(p.properties.$current_url, 'https://getgreenskeeper.com/tools/golf-trip-planner/'); assert.equal(p.properties.$referrer, 'https://example.com');
  assert.equal(JSON.stringify(p).includes('secret'), false); assert.equal(p.opts.referrerPolicy, 'no-referrer');
  ctx.location.pathname='/private-person-name/'; ctx.window.GKAnalytics.capture('$pageview'); assert.equal(ctx.payloads.at(-1).properties.$pathname, '/other');
});
test('browser opt-out applies immediately, persists and privacy signals cannot be overridden', () => {
  const ctx = fixture(); ctx.window.GKAnalytics.setOptOut(true); ctx.window.GKAnalytics.capture('export_completed');
  assert.equal(ctx.payloads.length, 1); assert.equal(ctx.data.get('greenskeeper:analytics-opt-out'), 'true'); assert.equal(ctx.data.has('greenskeeper:analytics-id'), false);
  ctx.window.GKAnalytics.setOptOut(false); ctx.window.GKAnalytics.capture('export_completed'); assert.equal(ctx.payloads.length, 2);
  ctx.navigator.globalPrivacyControl = true; ctx.window.GKAnalytics.setOptOut(false); ctx.window.GKAnalytics.capture('export_completed'); assert.equal(ctx.payloads.length, 2);
});
test('network and storage errors never escape capture', () => {
  const ctx = fixture(); ctx.fetch = () => { throw Error('offline'); }; assert.doesNotThrow(() => ctx.window.GKAnalytics.capture('tool_engaged'));
});
test('verification override labels every event as a test and cannot bypass privacy', () => {
  assert.equal(fixture({ webdriver:true, verification:true }).payloads[0].properties.verification_test, true);
  assert.equal(fixture({ webdriver:true, verification:true, gpc:true }).payloads.length, 0);
});
test('CTA targets and tool engagement use fixed categories', () => {
  const ctx=fixture(); const anchor={ href:'https://apps.apple.com/us/app/id6759922387?name=secret', closest:()=>null };
  ctx.listeners.click({ target:{ closest:()=>anchor } }); assert.equal(ctx.payloads.at(-1).properties.target,'app-store');
  const input={isTrusted:true,target:{closest:()=>({})}}; ctx.listeners.input(input); ctx.listeners.input(input);
  assert.equal(ctx.payloads.filter(p=>p.event==='tool_engaged').length,1);
});
test('packaged public pages include exactly one analytics script and production route manifest', () => {
  require('node:child_process').execFileSync(process.env.PYTHON || 'python3', ['scripts/package_site.py']);
  function walk(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(dir+'/'+e.name) : [dir+'/'+e.name]); }
  for(const file of walk('_site').filter(p=>p.endsWith('.html'))) { const html=fs.readFileSync(file,'utf8'); assert.equal((html.match(/src="[^"]*assets\/analytics.js"/g)||[]).length,1,file); assert.ok(html.includes('name="analytics-environment" content="production"'),file); }
});
