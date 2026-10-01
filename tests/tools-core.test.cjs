const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/tools-core.js');
const trip = () => ({ version: 1, name: 'A golf trip', start: '2026-10-01', end: '2026-10-03', zone: 'America/Denver', golfers: 8, events: [{ name: 'Round one', type: 'Golf', date: '2026-10-02', time: '08:00', duration: 270, buffer: 30, confirmed: false, note: 'Bring clubs' }] });
test('trip import rejects malformed, out-of-range, and oversized data', () => {
  assert.throws(() => C.validateTrip({ version: 2 }));
  assert.throws(() => C.validateTrip({ ...trip(), end: '2026-09-01' }));
  assert.throws(() => C.validateTrip({ ...trip(), golfers: 1.5 }));
  assert.throws(() => C.validateTrip({ ...trip(), events: Array(101).fill(trip().events[0]) }));
  const t = trip(); t.events[0].date = '2026-10-05'; assert.throws(() => C.validateTrip(t));
  assert.throws(() => C.date('2026-02-30'));
});
test('agenda flags overlaps including buffers and overnight activities', () => {
  const t = trip(); t.events.push({ ...t.events[0], name: 'Lunch', time: '12:45' });
  assert.equal(C.agenda(t)[1].conflict, true);
  t.events[1].time = '13:00'; assert.equal(C.agenda(t)[1].conflict, false);
  t.events[0].time = '23:30'; t.events[0].duration = 90; t.events[1].date = '2026-10-03'; t.events[1].time = '00:30';
  assert.equal(C.agenda(t)[1].conflict, true);
});
test('calendar exports actual UTC instants and escapes injected calendar lines', () => {
  const t = trip(); t.events[0].name = 'Golf\nEND:VEVENT;test,ok';
  const ics = C.calendar(t);
  assert.match(ics, /DTSTART:20261002T140000Z/);
  assert.match(ics, /DTEND:20261002T183000Z/);
  assert.match(ics, /SUMMARY:Golf\\nEND:VEVENT\\;test\\,ok/);
  assert.equal(ics.split('\r\n').filter(x => x === 'END:VEVENT').length, 1);
  t.events[0].note = '⛳️'.repeat(100);
  for (const line of C.calendar(t).split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});
test('timezone conversion handles summer/winter and rejects nonexistent DST times', () => {
  assert.equal(new Date(C.zonedInstant('2026-07-01','09:00','America/Denver')).toISOString(), '2026-07-01T15:00:00.000Z');
  assert.equal(new Date(C.zonedInstant('2026-12-01','09:00','America/Denver')).toISOString(), '2026-12-01T16:00:00.000Z');
  assert.throws(() => C.zonedInstant('2026-03-08','02:30','America/Denver'));
  assert.throws(() => C.timezone('made/up'));
});
test('budget distinguishes unknown from zero and multiplies each cost basis once', () => {
  const r = C.budget(8,3,[{ name:'Hotel',amount:'1200',basis:'total',people:8 },{ name:'Golf',amount:'100',basis:'person',people:6 },{ name:'Car',amount:'50',basis:'night',people:8 },{ name:'Food',amount:'20',basis:'personNight',people:8 },{ name:'Other',amount:'',basis:'total',people:8 },{ name:'Free',amount:'0',basis:'total',people:8 }]);
  assert.equal(r.total,243000); assert.equal(r.unknown,1); assert.equal(r.perPerson,30375); assert.equal(r.rows[1].perPerson,10000);
  assert.throws(() => C.budget(8,3,[{name:'Bad',amount:-1,basis:'total',people:8}]));
  assert.throws(() => C.budget(8,3,[{name:'Bad',amount:1,basis:'total',people:9}]));
});
test('currency calculation uses cents without floating point accumulation', () => {
  const r = C.budget(3,1,[{name:'Fee',amount:'0.10',basis:'person',people:3},{name:'Fee2',amount:'0.20',basis:'person',people:3}]);
  assert.equal(r.total,90); assert.equal(r.perPerson,30);
});
test('membership includes initiation only in year one and rounds up threshold', () => {
  const r = C.membership({annual:3500,monthly:50,joining:500,publicCost:85,memberCost:20,rounds:104});
  assert.equal(r.firstBreak,71); assert.equal(r.ongoingBreak,64); assert.equal(r.firstYear,6680); assert.equal(r.ongoing,6180); assert.equal(r.publicTotal,8840); assert.equal(r.delta,2160);
});
test('membership reports no savings-based break-even when member rate is not cheaper', () => {
  const r = C.membership({annual:1000,monthly:0,joining:0,publicCost:50,memberCost:50,rounds:100});
  assert.equal(r.firstBreak,null); assert.equal(r.delta,-1000);
  assert.throws(() => C.membership({annual:1000,monthly:'',joining:0,publicCost:50,memberCost:20,rounds:100}));
});
test('sunset matches reference seasonal values within a few minutes', () => {
  // Denver summer solstice ~20:31 MDT; winter solstice ~16:39 MST.
  const summer = C.zonedParts(new Date(C.sunset('2026-06-21',39.7392,-104.9903).sunset),'America/Denver');
  const winter = C.zonedParts(new Date(C.sunset('2026-12-21',39.7392,-104.9903).sunset),'America/Denver');
  assert.equal(summer.date,'2026-06-21'); assert.ok(Math.abs(summer.minutes - 1231) < 5);
  assert.ok(Math.abs(winter.minutes - 999) < 5);
  const sydney = C.zonedParts(new Date(C.sunset('2026-12-21',-33.8688,151.2093).sunset),'Australia/Sydney');
  assert.ok(Math.abs(sydney.minutes - 1205) < 5);
});
test('daylight comparison subtracts round and buffer and identifies late starts', () => {
  const data = { date:'2026-06-21',lat:39.7392,lng:-104.9903,zone:'America/Denver',duration:270,buffer:30,tee:'15:00' };
  const r = C.daylight(data); assert.ok(r.margin > 25 && r.margin < 40); assert.equal(r.latest,r.sunset - 300*60000);
  assert.ok(C.daylight({...data,tee:'17:00'}).margin < 0);
  assert.equal(C.daylight({...data,tee:'03:00'}).beforeSunrise,true);
});
test('polar day and night return explicit states instead of invalid dates', () => {
  assert.equal(C.sunset('2026-06-21',78.2232,15.6469).polar,'day');
  assert.equal(C.sunset('2026-12-21',78.2232,15.6469).polar,'night');
});
test('day trips have zero overnight charges', () => {
  assert.equal(C.budget(4,0,[{name:'Rooms',amount:100,basis:'night',people:4},{name:'Golf',amount:50,basis:'person',people:4}]).total,20000);
});
test('decimal membership costs do not add a phantom round at break-even', () => {
  assert.equal(C.membership({annual:0.3,monthly:0,joining:0,publicCost:0.3,memberCost:0.2,rounds:3}).firstBreak,3);
});
test('daylight supports timezones across the international date line', () => {
  const r=C.daylight({date:'2026-06-21',lat:1.8721,lng:-157.4278,zone:'Pacific/Kiritimati',duration:135,buffer:30,tee:'14:00'});
  assert.equal(C.zonedParts(new Date(r.sunset),'Pacific/Kiritimati').date,'2026-06-21');
});
