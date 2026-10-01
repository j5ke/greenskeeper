/* Pure browser calculations; no network, storage, or UI dependencies. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  function number(value, name, min = 0, max = 100000000) {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`${name} must be between ${min} and ${max}.`);
    return Number(value);
  }
  function integer(value, name, min = 1, max = 1000) {
    const n = number(value, name, min, max);
    if (!Number.isInteger(n)) throw new Error(`${name} must be a whole number.`);
    return n;
  }
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('Choose a valid date.');
    if (+value.slice(0, 4) < 2000 || +value.slice(0, 4) > 2100) throw new Error('Choose a date between 2000 and 2100.');
    return value;
  }
  function minutes(value) {
    if (!/^\d\d:\d\d$/.test(value)) throw new Error('Choose a valid time.');
    const [h, m] = value.split(':').map(Number);
    if (h > 23 || m > 59) throw new Error('Choose a valid time.');
    return h * 60 + m;
  }
  function clock(mins) {
    const whole = Math.round(mins);
    const day = Math.floor(whole / 1440);
    const m = ((whole % 1440) + 1440) % 1440;
    return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}${day > 0 ? ' (+1 day)' : day < 0 ? ' (previous day)' : ''}`;
  }
  function timezone(zone) {
    try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); } catch { throw new Error('Enter a valid timezone, such as America/Denver.'); }
    if (!zone || zone.length > 80 || /[\r\n;]/.test(zone)) throw new Error('Enter a valid timezone.');
    return zone;
  }
  function zonedParts(time, zone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone(zone), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(time);
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
  }
  function zonedInstant(day, time, zone) {
    date(day); minutes(time); timezone(zone);
    const target = Date.parse(`${day}T${time}:00Z`);
    let guess = target;
    for (let i = 0; i < 4; i++) {
      const p = zonedParts(new Date(guess), zone);
      const asUTC = Date.parse(`${p.date}T00:00:00Z`) + p.minutes * 60000;
      guess += target - asUTC;
    }
    const p = zonedParts(new Date(guess), zone);
    if (p.date !== day || p.minutes !== minutes(time)) throw new Error('That local time does not exist because clocks change. Choose another time.');
    return guess;
  }
  function validateTrip(raw) {
    if (!raw || raw.version !== 1 || typeof raw.name !== 'string' || raw.name.length > 100 || !Array.isArray(raw.events) || raw.events.length > 100) throw new Error('Choose a Greenskeeper trip file (version 1, up to 100 activities).');
    date(raw.start); date(raw.end); timezone(raw.zone); integer(raw.golfers, 'Golfers', 1, 100);
    if (raw.end < raw.start) throw new Error('The return date must be on or after arrival.');
    if ((Date.parse(raw.end) - Date.parse(raw.start)) / DAY > 60) throw new Error('Plan up to 60 days per trip.');
    const events = raw.events.map(e => {
      if (!e || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 140 || typeof e.note !== 'string' || e.note.length > 500 || !['Golf', 'Travel', 'Stay', 'Meal', 'Other'].includes(e.type) || typeof e.confirmed !== 'boolean') throw new Error('Each activity needs a name, type, and valid details.');
      date(e.date); minutes(e.time); number(e.duration, 'Activity duration', 5, 1440); number(e.buffer, 'Travel buffer', 0, 240);
      if (e.date < raw.start || e.date > raw.end) throw new Error(`${e.name}: date must be within the trip.`);
      zonedInstant(e.date, e.time, raw.zone);
      return { name: e.name.trim(), type: e.type, date: e.date, time: e.time, duration: +e.duration, buffer: +e.buffer, note: e.note, confirmed: e.confirmed };
    });
    return { version: 1, name: raw.name.trim() || 'My golf trip', start: raw.start, end: raw.end, zone: raw.zone, golfers: +raw.golfers, events };
  }
  function agenda(trip) {
    const entries = trip.events.map((e, index) => ({ ...e, index, start: zonedInstant(e.date, e.time, trip.zone) })).sort((a, b) => a.start - b.start);
    return entries.map((e, i) => ({ ...e, conflict: entries.slice(0, i).some(p => p.start + (p.duration + p.buffer) * 60000 > e.start) }));
  }
  const icsEscape = s => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const icsDate = t => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function calendar(trip) {
    const t = validateTrip(trip);
    // UTC events keep travel timezone and DST behavior intact in every calendar app.
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Greenskeeper//Golf Trip Planner//EN', 'CALSCALE:GREGORIAN'];
    agenda(t).forEach(e => lines.push('BEGIN:VEVENT', `UID:${e.start}-${e.index}@getgreenskeeper.com`, `DTSTAMP:${icsDate(Date.now())}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.start + e.duration * 60000)}`, `SUMMARY:${icsEscape(e.name)}`, `DESCRIPTION:${icsEscape(`${e.confirmed ? 'Confirmed' : 'Proposed'} · ${e.type}\n${e.note}\nAllow ${e.buffer} min after this activity.`)}`, 'END:VEVENT'));
    lines.push('END:VCALENDAR');
    // Fold to <=75 octets without splitting UTF-8 characters.
    return lines.map(line => {
      let out = '', current = '', size = 0;
      for (const char of line) { const bytes = new TextEncoder().encode(char).length; if (size + bytes > 74) { out += current + '\r\n '; current = ''; size = 1; } current += char; size += bytes; }
      return out + current;
    }).join('\r\n') + '\r\n';
  }
  function tripText(trip) {
    return `${trip.name}\n${trip.start} → ${trip.end} · ${trip.golfers} golfers\nTimes: ${trip.zone}\n\n` + agenda(trip).map(e => `${e.date} · ${clock(minutes(e.time))} — ${e.name}\n${e.type} · ${e.duration} min · ${e.confirmed ? 'Confirmed' : 'Proposed'}${e.conflict ? ' · Schedule overlap' : ''}${e.note ? '\n' + e.note : ''}`).join('\n\n');
  }
  function budget(golfers, nights, expenses) {
    integer(golfers, 'Golfers', 1, 100); integer(nights, 'Nights', 0, 60);
    let total = 0; let unknown = 0;
    const rows = expenses.map(e => {
      if (!['total', 'person', 'night', 'personNight'].includes(e.basis)) throw new Error('Choose a cost basis.');
      const count = integer(e.people, 'People sharing this cost', 1, golfers);
      const amount = e.amount === '' ? null : number(e.amount, e.name || 'Cost');
      const factor = { total: 1, person: count, night: nights, personNight: nights * count }[e.basis];
      const cents = amount === null ? 0 : Math.round(amount * 100) * factor;
      if (amount === null) unknown++;
      total += cents;
      return { ...e, cents, unknown: amount === null, perPerson: cents / count };
    });
    return { total, rows, unknown, perPerson: total / golfers };
  }
  function membership(data) {
    const annual = number(data.annual, 'Annual dues'); const monthly = number(data.monthly, 'Monthly minimum / fees'); const joining = number(data.joining, 'Joining fee');
    const publicCost = number(data.publicCost, 'Pay-as-you-play cost'); const memberCost = number(data.memberCost, 'Member cost per round');
    const rounds = integer(data.rounds, 'Annual rounds', 1, 1000);
    const fixedCents = Math.round(annual * 100) + Math.round(monthly * 100) * 12;
    const savingCents = Math.round(publicCost * 100) - Math.round(memberCost * 100);
    const fixed = fixedCents / 100; const saving = savingCents / 100;
    const publicTotal = publicCost * rounds; const ongoing = fixed + memberCost * rounds; const firstYear = ongoing + joining;
    return { fixed, saving, rounds, publicTotal, ongoing, firstYear, ongoingBreak: saving > 0 ? Math.ceil(fixedCents / savingCents) : null, firstBreak: saving > 0 ? Math.ceil((fixedCents + Math.round(joining * 100)) / savingCents) : null, delta: publicTotal - firstYear };
  }
  /* NOAA/Meeus solar equations. An apparent sunset estimate, not a weather forecast. */
  function solarTerms(jd) {
    const r = Math.PI / 180, t = (jd - 2451545) / 36525;
    const L = ((280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360 + 360) % 360;
    const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    const C = Math.sin(M * r) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * M * r) * (0.019993 - 0.000101 * t) + Math.sin(3 * M * r) * 0.000289;
    const omega = 125.04 - 1934.136 * t;
    const lambda = L + C - 0.00569 - 0.00478 * Math.sin(omega * r);
    const epsilon = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * r);
    const decl = Math.asin(Math.sin(epsilon * r) * Math.sin(lambda * r));
    const y = Math.tan(epsilon * r / 2) ** 2;
    const eq = 4 / r * (y * Math.sin(2 * L * r) - 2 * e * Math.sin(M * r) + 4 * e * y * Math.sin(M * r) * Math.cos(2 * L * r) - 0.5 * y * y * Math.sin(4 * L * r) - 1.25 * e * e * Math.sin(2 * M * r));
    return { decl, eq };
  }
  function sunset(day, latitude, longitude) {
    date(day); const lat = number(latitude, 'Latitude', -89.9, 89.9) * Math.PI / 180; const lng = number(longitude, 'Longitude', -180, 180);
    const midnight = Date.parse(`${day}T00:00:00Z`); const jd = midnight / DAY + 2440587.5;
    let terms = solarTerms(jd + (720 - 4 * lng) / 1440);
    let noon = 720 - 4 * lng - terms.eq;
    const angle = s => (Math.cos(90.833 * Math.PI / 180) - Math.sin(lat) * Math.sin(s.decl)) / (Math.cos(lat) * Math.cos(s.decl));
    let cos = angle(terms);
    if (cos < -1) return { polar: 'day' }; if (cos > 1) return { polar: 'night' };
    let sunsetMinutes = noon + 4 * Math.acos(cos) * 180 / Math.PI;
    terms = solarTerms(jd + sunsetMinutes / 1440); cos = angle(terms);
    if (cos < -1) return { polar: 'day' }; if (cos > 1) return { polar: 'night' };
    sunsetMinutes = 720 - 4 * lng - terms.eq + 4 * Math.acos(cos) * 180 / Math.PI;
    const sunrise = midnight + (720 - 4 * lng - terms.eq - 4 * Math.acos(cos) * 180 / Math.PI) * 60000;
    return { sunset: midnight + sunsetMinutes * 60000, sunrise };
  }
  function daylight(data) {
    timezone(data.zone); const duration = number(data.duration, 'Round duration', 30, 720); const buffer = number(data.buffer, 'Daylight buffer', 0, 180);
    let solar = sunset(data.date, data.lat, data.lng);
    // Some date-line timezones are a calendar day away from their solar longitude.
    if (!solar.polar && zonedParts(new Date(solar.sunset), data.zone).date !== data.date) {
      const localDay = zonedParts(new Date(solar.sunset), data.zone).date;
      const shift = localDay > data.date ? -86400000 : 86400000;
      solar = sunset(new Date(Date.parse(data.date + 'T12:00:00Z') + shift).toISOString().slice(0, 10), data.lat, data.lng);
    }
    if (solar.polar) return solar;
    if (zonedParts(new Date(solar.sunset), data.zone).date !== data.date) throw new Error('The timezone does not match this location. Check your course coordinates and timezone.');
    const tee = zonedInstant(data.date, data.tee, data.zone);
    const finish = tee + duration * 60000; const deadline = solar.sunset - buffer * 60000; const latest = deadline - duration * 60000;
    return { ...solar, tee, finish, deadline, latest, margin: Math.floor((deadline - finish) / 60000), beforeSunrise: tee < solar.sunrise };
  }
  const api = { number, integer, date, minutes, clock, timezone, zonedParts, zonedInstant, validateTrip, agenda, calendar, tripText, budget, membership, sunset, daylight };
  root.GKTools = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
