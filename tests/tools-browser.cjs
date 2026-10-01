/* Headless UI checks. Run against the local preview; see README for setup. */
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const base = process.env.TOOLS_BASE_URL || 'http://127.0.0.1:4173';
  const output = process.env.QA_OUTPUT || '/private/tmp/greenskeeper-tools-qa';
  await fs.mkdir(output, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const goto = slug => page.goto(`${base}/tools/${slug ? slug+'/' : ''}`);
  await goto('golf-trip-planner');
  await page.getByRole('button',{name:'Load an example trip'}).click();
  await page.getByRole('button',{name:'Replace draft'}).click();
  assert.equal(await page.locator('.agenda-item').count(),4);
  await page.reload(); assert.equal(await page.locator('.agenda-item').count(),4);
  await page.getByLabel('Course or activity').fill('A late lunch');
  await page.getByLabel('Start time',{exact:true}).fill('16:15');
  await page.getByRole('button',{name:'Add to itinerary'}).click();
  assert.equal(await page.locator('.agenda-item').count(),5);
  assert.ok(await page.locator('.conflict-note').count() > 0);
  await page.locator('.agenda-item').last().getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByLabel('Course or activity').fill('An edited round');
  await page.getByRole('button',{name:'Save activity'}).click();
  assert.ok(await page.getByRole('heading',{name:'An edited round'}).isVisible());
  const icsPromise = page.waitForEvent('download'); await page.getByRole('button',{name:'Add to calendar'}).click();
  const ics = await icsPromise; assert.equal(ics.suggestedFilename(),'greenskeeper-trip.ics');
  const contents = await fs.readFile(await ics.path(),'utf8'); assert.match(contents,/BEGIN:VCALENDAR/); assert.match(contents,/DTSTART:/);
  const jsonPromise = page.waitForEvent('download'); await page.getByRole('button',{name:'Download trip file'}).click();
  const json = await jsonPromise; const backup = await fs.readFile(await json.path(),'utf8'); assert.equal(JSON.parse(backup).events.length,5);
  await page.locator('#trip-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
  await page.locator('#tool-error').waitFor({state:'visible'}); assert.match(await page.locator('#tool-error').textContent(),/not valid JSON/);
  await page.locator('#trip-file').setInputFiles({name:'trip.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await page.getByRole('button',{name:'Replace draft'}).click(); assert.equal(await page.locator('.agenda-item').count(),5);
  await goto('golf-trip-budget-calculator');
  await page.getByLabel('Amount for cost 1',{exact:true}).fill('100');
  await page.getByLabel('Amount for cost 2',{exact:true}).fill('1200');
  assert.equal(await page.locator('#budget-total').textContent(),'$2,000.00');
  await page.getByLabel('Golfers',{exact:true}).fill('4');
  assert.equal(await page.locator('#budget-total').textContent(),'$1,600.00');
  assert.equal(await page.locator('#budget-person').textContent(),'$400.00');
  await page.reload(); assert.equal(await page.getByLabel('Golfers',{exact:true}).inputValue(),'4');
  await page.getByRole('button',{name:'+ Add a cost',exact:true}).click(); assert.equal(await page.locator('.expense-card').count(),6);
  await page.getByLabel('Amount for cost 6',{exact:true}).fill('50');
  assert.equal(await page.locator('#budget-total').textContent(),'$1,650.00');
  await goto('golf-daylight-calculator');
  await page.getByLabel('Round date').fill('2026-06-21');
  await page.getByLabel('Tee time',{exact:true}).fill('15:00');
  await page.getByRole('button',{name:'Check my round'}).click();
  assert.match(await page.locator('#daylight-verdict').textContent(),/Looks playable/);
  await page.getByLabel('Tee time',{exact:true}).fill('20:00'); await page.getByRole('button',{name:'Check my round'}).click();
  assert.match(await page.locator('#daylight-verdict').textContent(),/Too tight/);
  await page.getByLabel('9 holes',{exact:true}).check(); assert.equal(await page.getByLabel('Expected round (minutes)').inputValue(),'135');
  await page.getByLabel('Course area').selectOption('melbourne'); await page.getByLabel('Round date').fill('2026-12-21'); await page.getByRole('button',{name:'Check my round'}).click();
  assert.match(await page.locator('#daylight-context').textContent(),/Australia\/Melbourne/);
  await goto('golf-membership-calculator');
  assert.equal(await page.locator('#membership-break').textContent(),'71 rounds');
  await page.getByLabel('Member cost / round').fill('85'); assert.equal(await page.locator('#membership-break').textContent(),'No break-even');
  await page.getByLabel('Member cost / round').fill('20');
  await goto('golf-swing-analyzer');
  assert.match(await page.getByRole('link',{name:'Open Swingalysis'}).getAttribute('href'),/^https:\/\/swingalysis.com\/analyze/);
  const routes = ['', 'golf-trip-planner','golf-trip-budget-calculator','golf-daylight-calculator','golf-membership-calculator','golf-swing-analyzer'];
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    for (const slug of routes) {
      await goto(slug); await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('h1').count(),1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow,false,`${slug} overflows at ${width}`);
      assert.equal(await page.locator('img').evaluateAll(images => images.filter(i => !i.complete || i.naturalWidth === 0).length),0,`${slug} has broken images`);
      await page.screenshot({path:path.join(output,`${slug || 'hub'}-${width}.png`),fullPage:true});
      if (width === 1440) {
        const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        assert.deepEqual(audit.violations.map(v => ({id:v.id, nodes:v.nodes.map(n=>n.html)})), [], `${slug || 'hub'} accessibility`);
      }
    }
  }
  // Storage restrictions must not prevent using the calculator.
  await context.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage disabled'); }; });
  await goto('golf-trip-budget-calculator'); await page.getByLabel('Amount for cost 1',{exact:true}).fill('200');
  assert.match(await page.locator('#budget-save').textContent(),/unavailable/);
  assert.equal(errors.length,0,errors.join('\n'));
  await browser.close(); console.log(`PASS: planner, budget, daylight, membership, Swingalysis links, storage fallback, accessibility, and 12 responsive screenshots. ${output}`);
})().catch(error => { console.error(error); process.exit(1); });
