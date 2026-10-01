/* Progressive enhancement for Greenskeeper's local-only golf tools. */
(() => {
  'use strict';
  const C = window.GKTools;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const text = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  const el = (tag, className, content) => { const node = document.createElement(tag); node.className = className || ''; if (content !== undefined) node.textContent = content; return node; };
  const values = form => Object.fromEntries(new FormData(form));
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const addDays = (day, count) => new Date(Date.parse(day + 'T12:00:00Z') + count * 86400000).toISOString().slice(0, 10);
  const niceDate = day => new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
  const money = (cents, currency = 'USD') => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(cents / 100);
  let toastTimer;
  function notify(message) { const node = $('#tool-status'); node.textContent = message; node.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 5000); }
  function error(message = '') { const node = $('#tool-error'); node.textContent = message; node.hidden = !message; $('.tool-result')?.classList.toggle('is-invalid', !!message); }
  function guarded(action) { return (...args) => { try { error(); return action(...args); } catch (e) { error(e.message || 'Something went wrong. Please check your entries.'); } }; }
  function download(name, value, type) { const url = URL.createObjectURL(new Blob([value], { type })); const a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); window.dispatchEvent(new CustomEvent('greenskeeper:tool-export', { detail: type === 'text/calendar' ? 'calendar' : type === 'application/json' ? 'trip-file' : 'text' })); setTimeout(() => URL.revokeObjectURL(url), 2000); }
  async function copy(value, filename) { try { await navigator.clipboard.writeText(value); window.dispatchEvent(new CustomEvent('greenskeeper:tool-export', { detail: 'clipboard' })); notify('Copied. Ready for the group chat.'); } catch { download(filename + '.txt', value, 'text/plain'); notify('Clipboard unavailable. Your summary downloaded instead.'); } }
  function save(key, value, statusId) { try { localStorage.setItem(key, JSON.stringify(value)); if (statusId) text(statusId, 'Saved in this browser. Download or copy a backup before clearing browser data.'); } catch { if (statusId) text(statusId, 'Browser saving is unavailable. Keep this tab open and download or copy a backup.'); } }
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  function button(label, callback, className = 'text-button') { const b = el('button', className, label); b.type = 'button'; b.addEventListener('click', guarded(callback)); return b; }
  function confirmAction(label, action) {
    const dialog = el('dialog', 'tool-dialog'); const heading = el('h2', '', label); const p = el('p', '', 'This replaces the draft saved in this browser. Download a backup first if you want to keep it.'); const controls = el('div', 'export-actions');
    const cancel = button('Keep my draft', () => dialog.close(), 'secondary-button'); const proceed = button('Replace draft', () => { dialog.close(); action(); }, 'button');
    controls.append(cancel, proceed); dialog.append(heading, p, controls); dialog.setAttribute('aria-label', label); document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove()); dialog.showModal(); cancel.focus();
  }
  $$('[data-print]').forEach(b => b.addEventListener('click', () => window.print()));
  const tool = $('.tool-page')?.dataset.tool;
  if (!tool || !C) return;

  const resultPanel = $('.tool-result');
  if (resultPanel) {
    resultPanel.id = 'tool-result';
    const jump = button('View my results ↓', () => resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 'mobile-result-jump');
    document.body.append(jump);
    const updateJump = () => { jump.hidden = resultPanel.getBoundingClientRect().top < innerHeight - 80; };
    window.addEventListener('scroll', updateJump, { passive: true }); window.addEventListener('resize', updateJump); updateJump();
  }

  if (tool === 'golf-trip-planner') {
    const form = $('#trip-form'), eventForm = $('#event-form'); const key = 'greenskeeper:trip:v1';
    let trip = { version: 1, name: 'The next great golf trip', start: today(), end: addDays(today(), 3), zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Denver', golfers: 8, events: [] };
    let editing = null;
    const stored = load(key); if (stored) { try { trip = C.validateTrip(stored); } catch { error('Your saved trip could not be read. Start a new plan or open a downloaded trip file.'); } }
    function syncForm() { Object.entries(trip).forEach(([k, v]) => { if (form.elements.namedItem(k)) form.elements.namedItem(k).value = v; }); eventForm.elements.eventDate.value = trip.start; }
    function current() { return C.validateTrip({ ...trip, ...values(form) }); }
    function update() { trip = current(); render(); save(key, trip, 'save-status'); }
    function render() {
      text('trip-title', trip.name); text('trip-summary', `${niceDate(trip.start)} → ${niceDate(trip.end)} · ${trip.golfers} golfers · ${trip.zone}`); text('trip-count', `${trip.events.length} ${trip.events.length === 1 ? 'activity' : 'activities'}`);
      const out = $('#itinerary'); out.replaceChildren();
      if (!trip.events.length) { const empty = el('div', 'itinerary-empty'); empty.append(el('span', 'empty-number', '01'), el('h3', '', 'First tee. Fresh page.'), el('p', '', 'Add your first round or load the example trip to see your itinerary take shape.')); out.append(empty); }
      let lastDate;
      C.agenda(trip).forEach(e => {
        if (e.date !== lastDate) { out.append(el('h3', 'agenda-day', niceDate(e.date))); lastDate = e.date; }
        const item = el('article', 'agenda-item' + (e.conflict ? ' has-conflict' : ''));
        item.append(el('span', 'agenda-time', C.clock(C.minutes(e.time))));
        const content = el('div', 'agenda-content'); content.append(el('span', 'agenda-kind', `${e.type} · ${e.confirmed ? 'Confirmed' : 'Proposed'}`), el('h4', '', e.name), el('p', '', `${e.duration} min${e.buffer ? ` + ${e.buffer} min buffer` : ''}`));
        if (e.note) content.append(el('p', 'agenda-note', e.note));
        if (e.conflict) content.append(el('p', 'conflict-note', 'Overlaps an earlier activity or its travel buffer.'));
        const actions = el('div', 'agenda-actions');
        actions.append(button('Edit', () => {
          editing = e.index;
          const mapped = { eventName: e.name, eventType: e.type, eventDate: e.date, eventTime: e.time, eventDuration: e.duration, eventBuffer: e.buffer, eventNote: e.note };
          Object.entries(mapped).forEach(([k,v]) => { eventForm.elements[k].value = v; }); eventForm.elements.eventConfirmed.checked = e.confirmed;
          $('button[type=submit]', eventForm).textContent = 'Save activity'; $('#cancel-edit').hidden = false; eventForm.elements.eventName.focus(); eventForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }), button('Remove', () => { trip.events.splice(e.index, 1); cancelEdit(); update(); }));
        content.append(actions); item.append(content); out.append(item);
      });
      $('#calendar-trip').disabled = !trip.events.length;
    }
    function cancelEdit() { editing = null; eventForm.reset(); eventForm.elements.eventDate.value = trip.start; $('button[type=submit]', eventForm).textContent = 'Add to itinerary ↗'; $('#cancel-edit').hidden = true; }
    const cancel = button('Cancel edit', cancelEdit); cancel.id = 'cancel-edit'; cancel.hidden = true; eventForm.append(cancel);
    syncForm(); render();
    form.addEventListener('input', guarded(update)); form.addEventListener('submit', e => e.preventDefault());
    eventForm.addEventListener('submit', guarded(e => {
      e.preventDefault(); trip = current(); const v = values(eventForm);
      const activity = { name: v.eventName, type: v.eventType, date: v.eventDate, time: v.eventTime, duration: +v.eventDuration, buffer: +v.eventBuffer, note: v.eventNote, confirmed: !!v.eventConfirmed };
      const next = [...trip.events]; if (editing !== null) next[editing] = activity; else next.push(activity);
      trip = C.validateTrip({ ...trip, events: next }); cancelEdit(); update(); notify('Itinerary updated.');
    }));
    $('#sample-trip').addEventListener('click', () => confirmAction('Load the example trip?', () => {
      const start = today(); trip = { version: 1, name: 'Three days. All golf.', start, end: addDays(start, 2), zone: 'America/Denver', golfers: 8, events: [
        { name: 'Arrival & check-in', type: 'Stay', date: start, time: '16:00', duration: 60, buffer: 30, note: 'Example only — replace with your accommodation.', confirmed: false },
        { name: 'The first big round', type: 'Golf', date: addDays(start, 1), time: '08:30', duration: 270, buffer: 45, note: 'Confirm tee times for both foursomes.', confirmed: false },
        { name: 'Dinner with the group', type: 'Meal', date: addDays(start, 1), time: '18:30', duration: 90, buffer: 0, note: 'Book a table for eight.', confirmed: false },
        { name: 'One last nine', type: 'Golf', date: addDays(start, 2), time: '08:00', duration: 135, buffer: 45, note: 'Leave time for the journey home.', confirmed: false }
      ] }; syncForm(); cancelEdit(); update(); notify('Example loaded. Make it yours.');
    }));
    $('#clear-trip').addEventListener('click', () => confirmAction('Start a fresh trip?', () => { trip = { ...trip, name: 'My golf trip', events: [] }; syncForm(); cancelEdit(); update(); }));
    $('#import-trip').addEventListener('click', () => $('#trip-file').click());
    $('#trip-file').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try { if (file.size > 200000) throw new Error('Choose a trip JSON file smaller than 200 KB.'); const parsed = C.validateTrip(JSON.parse(await file.text())); confirmAction('Open this trip file?', () => { trip = parsed; syncForm(); cancelEdit(); update(); notify('Trip file opened.'); }); } catch (err) { error(err instanceof SyntaxError ? 'This file is not valid JSON. Choose a downloaded Greenskeeper trip file.' : err.message); } finally { e.target.value = ''; }
    });
    $('#copy-trip').addEventListener('click', guarded(() => copy(C.tripText(current()), 'greenskeeper-trip')));
    $('#download-trip').addEventListener('click', guarded(() => download('greenskeeper-trip.json', JSON.stringify(current(), null, 2), 'application/json')));
    $('#calendar-trip').addEventListener('click', guarded(() => download('greenskeeper-trip.ics', C.calendar(current()), 'text/calendar')));
  }

  if (tool === 'golf-trip-budget-calculator') {
    const form = $('#budget-form'), key = 'greenskeeper:budget:v1';
    const defaults = () => ['Green fees — all rounds', 'Accommodation', 'Transport', 'Food & drinks', 'Carts, caddies & extras'].map((name, i) => ({ name, amount: '', basis: i === 0 || i === 3 ? 'person' : 'total', people: 8 }));
    let rows = defaults(); let lastGolfers = 8; let lastResult;
    const stored = load(key);
    if (stored) { try { if (!Array.isArray(stored.rows) || stored.rows.length > 40 || !['USD','GBP','EUR','CAD','AUD'].includes(stored.currency)) throw new Error(); C.budget(stored.golfers, stored.nights, stored.rows); if (stored.rows.some(r => typeof r.name !== 'string' || r.name.length > 100)) throw new Error(); rows = stored.rows; form.elements.golfers.value = stored.golfers; form.elements.nights.value = stored.nights; form.elements.currency.value = stored.currency; lastGolfers = +stored.golfers; } catch { error('Saved budget could not be read. Please enter your costs again.'); } }
    function inputField(label, value, type, attrs, callback) {
      const l = el('label', 'field'), span = el('span', '', label), input = el('input'); input.type = type; input.value = value; Object.entries(attrs).forEach(([k,v]) => input.setAttribute(k,v)); input.addEventListener('input', guarded(() => callback(input.value))); l.append(span,input); return l;
    }
    function renderRows() {
      const list = $('#expense-list'); list.replaceChildren();
      rows.forEach((row, i) => {
        const card = el('div', 'expense-card');
        const header = el('div', 'expense-head'); header.append(inputField('Cost name', row.name, 'text', { maxlength: 100, 'aria-label': `Cost ${i + 1} name` }, v => { row.name = v; update(); }), button('Remove', () => { rows.splice(i, 1); renderRows(); update(); }));
        const fields = el('div', 'fields three');
        fields.append(inputField('Amount', row.amount, 'number', { min: 0, max: 100000000, step: '0.01', placeholder: 'Not entered', 'aria-label': `Amount for cost ${i + 1}` }, v => { row.amount = v; update(); }));
        const label = el('label', 'field'); label.append(el('span', '', 'Price is')); const s = el('select'); s.setAttribute('aria-label', `Price basis for cost ${i + 1}`);
        [['total','Total'],['person','Per person'],['night','Per night'],['personNight','Per person / night']].forEach(([v,t]) => { const o = el('option','',t); o.value = v; s.append(o); }); s.value = row.basis; s.addEventListener('change', guarded(() => { row.basis = s.value; update(); })); label.append(s); fields.append(label);
        fields.append(inputField('People sharing', row.people, 'number', { min: 1, max: form.elements.golfers.value, step: 1, 'aria-label': `People sharing cost ${i + 1}` }, v => { row.people = v; update(); }));
        card.append(header, fields); list.append(card);
      });
    }
    function update() {
      const v = values(form); const result = C.budget(+v.golfers, +v.nights, rows); lastResult = { ...result, ...v };
      text('budget-total', money(result.total, v.currency)); text('budget-person', money(result.perPerson, v.currency)); text('budget-group', `${v.golfers} · ${v.nights}`);
      text('budget-unknown', result.unknown ? `${result.unknown} ${result.unknown === 1 ? 'cost still needs' : 'costs still need'} an amount. This is a partial budget.` : rows.length ? 'All costs entered. Your quotes, your numbers.' : 'Add a cost to start your budget.');
      const list = $('#budget-breakdown'); list.replaceChildren();
      result.rows.forEach(r => { const item = el('div', 'cost-row'); const desc = el('div'); desc.append(el('strong','',r.name || 'Unnamed cost'),el('small','',r.unknown ? 'Not entered yet' : `${money(r.perPerson,v.currency)} each · ${r.people} sharing`)); item.append(desc,el('span','',r.unknown ? '—' : money(r.cents,v.currency))); list.append(item); });
      if (+v.golfers > 1) { const fewer = C.budget(+v.golfers - 1, +v.nights, rows.map(r => ({ ...r, people: Math.max(1,+r.people - 1) }))); text('budget-scenario', `${v.golfers - 1} golfers: ${money(fewer.total,v.currency)} total, averaging ${money(fewer.perPerson,v.currency)} each.${result.unknown ? ' Still a partial budget.' : ''}`); } else text('budget-scenario', 'Add more than one golfer to compare a smaller group.');
      save(key, { ...v, rows }, 'budget-save');
    }
    form.addEventListener('input', guarded(() => { const n = C.integer(form.elements.golfers.value,'Golfers',1,100); if (n !== lastGolfers) { rows.forEach(r => { if (+r.people === lastGolfers) r.people = n; else r.people = Math.min(+r.people,n); }); lastGolfers = n; renderRows(); } update(); })); form.addEventListener('submit', e => e.preventDefault());
    $('#add-expense').addEventListener('click', guarded(() => { if (rows.length >= 40) throw new Error('Use up to 40 costs per trip.'); rows.push({ name: '', amount: '', basis: 'total', people: +form.elements.golfers.value }); renderRows(); update(); $('#expense-list').lastElementChild.querySelector('input').focus(); }));
    $('#reset-budget').addEventListener('click', () => confirmAction('Reset this budget?', () => { form.reset(); lastGolfers = 8; rows = defaults(); renderRows(); update(); }));
    $('#copy-budget').addEventListener('click', guarded(() => { update(); const r = lastResult; copy(`Golf trip budget · ${r.golfers} golfers · ${r.nights} nights\n${r.rows.map(x => `${x.name || 'Cost'}: ${x.unknown ? 'Not entered' : money(x.cents,r.currency)} (${x.people} sharing)`).join('\n')}\nTotal: ${money(r.total,r.currency)}\nAverage per golfer: ${money(r.perPerson,r.currency)}${r.unknown ? '\nPartial budget: some costs are not entered.' : ''}`, 'golf-trip-budget'); }));
    const savedTrip = load('greenskeeper:trip:v1');
    if (savedTrip) {
      try {
        const source = C.validateTrip(savedTrip); $('#use-trip').hidden = false;
        $('#use-trip').addEventListener('click', guarded(() => {
          const n = source.golfers; rows.forEach(r => { r.people = +r.people === lastGolfers ? n : Math.min(+r.people,n); });
          form.elements.golfers.value = n; form.elements.nights.value = Math.round((Date.parse(source.end)-Date.parse(source.start))/86400000); lastGolfers = n; renderRows(); update(); notify(`Group and nights copied from ${source.name}.`);
        }));
      } catch { /* An invalid trip draft never blocks budgeting. */ }
    }
    renderRows(); guarded(update)();
  }

  if (tool === 'golf-daylight-calculator') {
    const form = $('#daylight-form'); let summary = '';
    const cities = { denver:[39.7392,-104.9903,'America/Denver'], scottsdale:[33.4942,-111.9261,'America/Phoenix'], myrtle:[33.6891,-78.8867,'America/New_York'], sandiego:[32.7157,-117.1611,'America/Los_Angeles'], palmsprings:[33.8303,-116.5453,'America/Los_Angeles'], traverse:[44.7631,-85.6206,'America/Detroit'], standrews:[56.3398,-2.7967,'Europe/London'], dublin:[53.3498,-6.2603,'Europe/Dublin'], melbourne:[-37.8136,144.9631,'Australia/Melbourne'] };
    form.elements.date.value = today();
    function format(time, zone, day) { const p = C.zonedParts(new Date(time),zone); return C.clock(p.minutes) + (p.date !== day ? ` (${niceDate(p.date)})` : ''); }
    function update() {
      summary = ''; const v = values(form), result = C.daylight(v);
      if (result.polar) {
        text('daylight-latest', 'No usual sunset'); text('daylight-verdict', result.polar === 'day' ? 'The sun stays above the horizon on this date. Check local course hours.' : 'The sun stays below the horizon on this date. Daylight golf is not available.'); text('daylight-finish','—'); text('daylight-sunset','—'); text('daylight-context',v.zone); $('#copy-daylight').disabled = true; return;
      }
      $('#copy-daylight').disabled = false;
      const fmt = t => format(t,v.zone,v.date); text('daylight-latest',fmt(result.latest)); text('daylight-finish',fmt(result.finish)); text('daylight-sunset',fmt(result.sunset));
      const verdict = result.beforeSunrise ? 'Your tee time is before estimated sunrise. Choose a later start.' : result.margin >= 0 ? `Looks playable. ${result.margin} minutes to spare before your ${v.buffer}-minute buffer.` : `Too tight for this plan. Start ${Math.abs(result.margin)} minutes earlier, shorten the round, or choose nine.`;
      text('daylight-verdict',verdict); text('daylight-context',`${v.holes} holes · ${v.duration} minutes · ${niceDate(v.date)} · ${v.zone}. Estimated times, rounded to the minute.`);
      $('#daylight-marker').style.left = `${Math.max(2,Math.min(98,(result.finish - result.sunrise)/(result.sunset-result.sunrise)*100))}%`;
      summary = `Golf daylight estimate · ${niceDate(v.date)}\n${v.holes} holes · ${v.zone}\nTee time: ${C.clock(C.minutes(v.tee))}\nLatest suggested tee time: ${fmt(result.latest)}\nEstimated finish: ${fmt(result.finish)}\nSunset: ${fmt(result.sunset)}\n${verdict}\nAllow for weather, shade, pace, and course closing times.`;
    }
    const live = () => { try { error(); update(); } catch (e) { error(e.message); text('daylight-latest','—'); text('daylight-verdict','Check the details to update your estimate.'); text('daylight-finish','—'); text('daylight-sunset','—'); summary = ''; $('#copy-daylight').disabled = true; } };
    form.addEventListener('submit', e => { e.preventDefault(); live(); });
    form.addEventListener('change', e => {
      if (e.target.name === 'place') { const c = cities[e.target.value]; if (c) { form.elements.lat.value = c[0]; form.elements.lng.value = c[1]; form.elements.zone.value = c[2]; } else $('#location-details').open = true; }
      if (['lat','lng','zone'].includes(e.target.name)) form.elements.place.value = 'custom';
      if (e.target.name === 'holes') form.elements.duration.value = e.target.value === '9' ? '135' : '270'; live();
    });
    $('#locate-course').addEventListener('click', () => {
      if (!navigator.geolocation) { error('Location is unavailable. Enter course coordinates instead.'); return; }
      const b = $('#locate-course'); b.disabled = true; b.textContent = 'Finding your location…';
      navigator.geolocation.getCurrentPosition(p => { b.disabled = false; b.textContent = 'Use my location'; form.elements.lat.value = p.coords.latitude.toFixed(5); form.elements.lng.value = p.coords.longitude.toFixed(5); form.elements.zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone; form.elements.place.value = 'custom'; live(); notify('Coordinates set. Check that the timezone matches the course.'); }, () => { b.disabled = false; b.textContent = 'Use my location'; error('Location was unavailable or declined. Enter course coordinates instead.'); }, { timeout: 10000, maximumAge: 60000 });
    });
    $('#copy-daylight').addEventListener('click', guarded(() => { update(); if (summary) copy(summary,'golf-daylight'); })); live();
  }

  if (tool === 'golf-membership-calculator') {
    const form = $('#membership-form'); let summary = '';
    function update() {
      const v = values(form), r = C.membership(v), cash = n => money(n*100,v.currency);
      text('membership-break',r.firstBreak === null ? 'No break-even' : `${r.firstBreak} rounds`); text('membership-ongoing-break',r.ongoingBreak === null ? 'No break-even' : `${r.ongoingBreak} rounds`); text('membership-weekly',(r.rounds/52).toFixed(1));
      text('membership-verdict',r.delta > 0 ? `${cash(r.delta)} less in your first year at ${r.rounds} rounds.` : r.delta < 0 ? `${cash(-r.delta)} more in your first year at ${r.rounds} rounds.` : `The two options cost the same at ${r.rounds} rounds.`);
      const bars = $('#membership-bars'); bars.replaceChildren(); const max = Math.max(r.publicTotal,r.firstYear,r.ongoing,1);
      [['Pay as you play',r.publicTotal],['Member · first year',r.firstYear],['Member · later years',r.ongoing]].forEach(([label,total]) => { const item = el('div','comparison-row'); const head = el('div'); head.append(el('span','',label),el('strong','',cash(total))); const track = el('div','comparison-track'), fill = el('span'); fill.style.width = `${total/max*100}%`; track.append(fill); item.append(head,track); bars.append(item); });
      text('membership-context',r.saving <= 0 ? 'The member cost per round is at least the public rate. Playing more rounds does not recover fixed fees through round savings.' : `${cash(r.fixed)} in recurring annual costs. Each member round saves ${cash(r.saving)} before those fixed costs. Break-even means costing the same or less.`);
      summary = `Golf membership comparison · ${r.rounds} rounds/year\nPay as you play: ${cash(r.publicTotal)}\nMember first year: ${cash(r.firstYear)}\nMember later years: ${cash(r.ongoing)}\nFirst-year break-even: ${r.firstBreak === null ? 'Not reached through round savings' : r.firstBreak + ' rounds'}\nRecurring break-even: ${r.ongoingBreak === null ? 'Not reached through round savings' : r.ongoingBreak + ' rounds'}`;
    }
    form.addEventListener('input', () => { try { error(); update(); $('#copy-membership').disabled = false; } catch(e) { error(e.message); summary = ''; text('membership-break','—'); text('membership-verdict','Complete the inputs to update your comparison.'); $('#copy-membership').disabled = true; } });
    form.addEventListener('submit', guarded(e => { e.preventDefault(); update(); notify('Comparison updated.'); }));
    $('#copy-membership').addEventListener('click', guarded(() => { update(); copy(summary,'golf-membership'); })); guarded(update)();
  }
})();
