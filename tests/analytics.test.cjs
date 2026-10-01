const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('assets/analytics.js', 'utf8');
function fixture(options = {}) {
  const scripts = [], listeners = {};
  const context = {
    URL, Set,
    window: { addEventListener: (name, handler) => { listeners[name] = handler; } },
    location: { hostname: options.host || 'getgreenskeeper.com', pathname: '/tools/golf-trip-planner/', href: 'https://getgreenskeeper.com/tools/golf-trip-planner/', origin: 'https://getgreenskeeper.com' },
    navigator: { doNotTrack: options.dnt, globalPrivacyControl: options.gpc },
    localStorage: { getItem: () => options.optOut },
    document: {
      querySelector: selector => selector.includes('plausible') ? { content: options.script ?? 'https://plausible.io/js/pa-test123.js' } : { dataset: { tool: 'golf-trip-planner' } },
      head: { append: node => scripts.push(node) }, createElement: () => ({}),
      addEventListener: (name, handler) => { listeners[name] = handler; },
    },
  };
  vm.runInNewContext(source, context);
  return { ...context, scripts, listeners };
}
test('no collector on unconfigured, preview, opted-out, or privacy-signalled visits', () => {
  for (const options of [{ script: '' }, { script: 'https://evil.test/script.js' }, { host: 'preview.vercel.app' }, { dnt: '1' }, { gpc: true }, { optOut: 'true' }]) assert.equal(fixture(options).scripts.length, 0);
});
test('redacts arbitrary query strings, fragments and referrer paths while retaining campaign attribution', () => {
  const ctx = fixture();
  assert.equal(ctx.scripts.length, 1);
  const payload = ctx.window.plausible.o.transformRequest({ u: 'https://getgreenskeeper.com/tools/?name=private&lat=40&utm_source=newsletter#secret', r: 'https://example.com/private-path?email=secret' });
  assert.equal(payload.u, 'https://getgreenskeeper.com/tools/?utm_source=newsletter');
  assert.equal(payload.r, 'https://example.com');
});
test('completed exports allow only known formats and do not include user content', () => {
  const ctx = fixture();
  ctx.listeners['greenskeeper:tool-export']({ detail: 'private booking notes' });
  assert.equal(ctx.window.plausible.q, undefined);
  ctx.listeners['greenskeeper:tool-export']({ detail: 'calendar' });
  const [name, data] = ctx.window.plausible.q[0];
  assert.equal(name, 'Tool export completed');
  assert.equal(data.props.format, 'calendar');
  assert.deepEqual(Object.keys(data.props).sort(), ['format', 'site', 'tool']);
});
test('App Store clicks are counted without forwarding the target URL or anchor text', () => {
  const ctx = fixture();
  const anchor = { href: 'https://apps.apple.com/us/app/id6759922387?private=secret', closest: () => null };
  ctx.listeners.click({ target: { closest: () => anchor } });
  const [name, data] = ctx.window.plausible.q[0];
  assert.equal(name, 'App Store click');
  assert.deepEqual(Object.keys(data.props).sort(), ['placement', 'site', 'tool']);
});
