/* Offline contract checks; PRODUCTION_ANALYTICS_VERIFY=1 explicitly sends labelled test events. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const live = process.env.PRODUCTION_ANALYTICS_VERIFY === '1';
  const browser = await chromium.launch({ headless:true });
  try {
    const context = await browser.newContext({ permissions:['clipboard-read','clipboard-write'] });
    await context.addInitScript(() => sessionStorage.setItem('greenskeeper:analytics-verification','true'));
    const captured = [], responses = [], errors = [];
    if (!live) await context.route('https://getgreenskeeper.com/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = path.join(process.cwd(),'_site',pathname.endsWith('/') ? pathname+'index.html' : pathname);
      await route.fulfill({ path:file, contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':undefined });
    });
    await context.route('https://us.i.posthog.com/**', async route => {
      const payload=route.request().postDataJSON(); captured.push(payload);
      if (live) await route.continue(); else await route.fulfill({ status:200, body:'{"status":1}' });
    });
    const page=await context.newPage(); page.on('pageerror', e=>errors.push(e.message));
    page.on('response', async r=> { if(r.url().includes('us.i.posthog.com')) responses.push(r.status()); });
    const visit = async route => { const start=captured.filter(p=>p.event==='$pageview').length; await page.goto('https://getgreenskeeper.com'+route); await page.waitForTimeout(250); assert.equal(captured.filter(p=>p.event==='$pageview').length,start+1,route); };
    await visit('/');
    await page.locator('nav a[href*="tools/"]').click(); await page.waitForTimeout(250);
    assert.ok(captured.some(p=>p.event==='cta_clicked' && p.properties.target==='tools'));
    await visit('/tools/golf-trip-planner/');
    await page.locator('#event-form [name=eventName]').fill('PRIVATE COURSE SECRET');
    await page.locator('#event-form button[type=submit]').click();
    await page.locator('#download-trip').click(); await page.locator('#calendar-trip').click(); await page.locator('#copy-trip').click();
    await page.locator('#trip-file').setInputFiles({name:'SECRET.json',mimeType:'application/json',buffer:Buffer.from('invalid private secret')});
    const saved = await page.evaluate(()=>localStorage.getItem('greenskeeper:trip:v1'));
    await page.locator('#trip-file').setInputFiles({name:'SECRET.json',mimeType:'application/json',buffer:Buffer.from(saved)});
    await page.getByRole('button',{name:'Replace draft',exact:true}).click();
    await visit('/tools/golf-trip-budget-calculator/'); await page.locator('#budget-form [name=golfers]').fill('6'); await page.locator('#copy-budget').click();
    await visit('/tools/golf-daylight-calculator/'); await page.locator('#daylight-form button[type=submit]').click(); await page.locator('#copy-daylight').click();
    await visit('/tools/golf-membership-calculator/'); await page.locator('#membership-form button[type=submit]').click(); await page.locator('#copy-membership').click();
    if (!live) {
      await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('PRIVATE SECRET'); }; });
      await page.locator('#copy-membership').click();
      await page.waitForTimeout(150);
      assert.ok(captured.some(p=>p.event==='export_failed' && p.properties.format==='clipboard'));
      assert.ok(captured.some(p=>p.event==='export_completed' && p.properties.format==='text'));
      const before=captured.length;
      await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('PRIVATE SECRET'); }; });
      await page.locator('#copy-membership').click(); await page.waitForTimeout(150);
      assert.equal(captured.slice(before).filter(p=>p.event==='export_failed'&&p.properties.format==='text').length,1);
    }
    await visit('/tools/golf-swing-analyzer/');
    await visit('/blog/'); await page.locator('#journal-search').fill('PRIVATE SEARCH SECRET'); await page.waitForTimeout(1700); await page.locator('.filter').last().click();
    await visit('/support.html'); await visit('/terms.html'); await visit('/privacy.html');
    await page.waitForTimeout(500);
    for(const tool of ['golf-trip-planner','golf-trip-budget-calculator','golf-daylight-calculator','golf-membership-calculator']) assert.ok(captured.some(p=>p.event==='export_completed'&&p.properties.tool===tool),tool);
    for(const event of ['form_submission','import_completed','import_failed','journal_used','tool_engaged']) assert.ok(captured.some(p=>p.event===event),event);
    for(const p of captured) { assert.equal(p.properties.verification_test,true); assert.equal(p.properties.token,p.api_key); assert.equal(p.properties.$geoip_disable,true); assert.equal(/PRIVATE|SECRET|invalid private/.test(JSON.stringify(p)),false); }
    const count=captured.length; await page.locator('#analytics-disable').click(); await page.reload(); await page.waitForTimeout(300); assert.equal(captured.length,count);
    assert.equal(errors.length,0,errors.join('\n')); if(live) assert.ok(responses.every(s=>s===200),JSON.stringify(responses));
    console.log(JSON.stringify({live,events:captured.length,distinctId:captured[0].distinct_id,counts:captured.reduce((a,p)=>(a[p.event]=(a[p.event]||0)+1,a),{}),responses,errors},null,2));
    await context.close();
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });
