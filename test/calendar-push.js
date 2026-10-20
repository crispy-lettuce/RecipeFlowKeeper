/* Tests the calendar push's Edge Functions: what calendar-sync writes into
 * Google Calendar for a planned day, and how calendar-auth builds the
 * consent link and reads Google's answer.
 *
 * Like source-ingredients.js, this lifts the code out of the real function
 * sources rather than keeping a copy, so a copy cannot drift and pass while
 * the deployed function fails. The lifted sections are the ones between the
 * "pure" markers in supabase/functions/calendar-sync/index.ts and
 * supabase/functions/calendar-auth/index.ts; their type annotations are
 * stripped with the same patterns. If a function goes missing, this throws
 * rather than passing vacuously.
 *
 * Nothing here talks to Google. It proves what the functions would send,
 * not that Google does what its documentation says with it: the household's
 * first connection and the 20:00 reminder on the phone are that
 * (docs/TEST-PLAN.md, step 40a). Every recipe title here is made up.
 *
 *   node test/calendar-push.js
 *
 * Added 1 Oct 2026, P3 PR 1. */
'use strict';
const fs = require('fs');
const path = require('path');

const FUNCS = path.join(__dirname, '..', 'supabase', 'functions');

function load(name, exported){
  const file = path.join(FUNCS, name, 'index.ts');
  const src = fs.readFileSync(file, 'utf8');
  const from = src.indexOf('/* ---- pure: lifted');
  const to = src.indexOf('/* ---- end pure ---- */');
  if(from < 0 || to < from) throw new Error('could not find the pure section in ' + file);
  /* What the section refers to from above it: the constants it uses. */
  const consts = (src.slice(0, from).match(/^const (APP_URL|GOOGLE_AUTH_URL|ALLOWED_ORIGIN) = .*$/gm) || []).join('\n');
  const js = src.slice(from, to)
    // function f(a: T, b: U): R {   ->   function f(a, b) {
    .replace(/function\s+(\w+)\s*\(([^)]*)\)[^\n{]*\{\s*$/gm,
      (_, fname, args) => `function ${fname}(${args.split(',').map(a => a.split(':')[0].trim()).filter(Boolean).join(', ')}) {`)
    // (a: T): R =>   and   (a: T) =>
    .replace(/\(([\w$]+)\s*:\s*[^()]*?\)\s*(:\s*[\w<>|\[\] ]+)?\s*=>/g, '($1) =>')
    // const X: T = …   and   let x: T = …   and   let x: T;
    .replace(/\b(const|let)\s+([\w$]+)\s*:\s*[^=;\n]+(\s*[=;])/g, '$1 $2$3');
  const out = new Function(consts + '\n' + js + `\nreturn { ${exported.join(', ')} };`)();
  for(const fname of exported){
    if(typeof out[fname] !== 'function') throw new Error(`${fname} missing from ${file}: checks would be vacuous`);
  }
  return out;
}

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail !== undefined && !pass ? '  (' + detail + ')' : ''}`);
};

const sync = load('calendar-sync', ['calendarEventId', 'mealEventId', 'dayEventIds', 'dateFromEventId', 'nextDate', 'reminderMinutes',
  'londonToday', 'dishStates', 'eventsForDay', 'syncActions', 'parseSyncRequest', 'staleConnection', 'lastAllDate']);
const auth = load('calendar-auth', ['consentUrl', 'safeReturnTo', 'withOutcome', 'emailFromIdToken', 'grantedEnough', 'requestedScope']);

const HH = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';
const HH2 = '11111111-2222-3333-4444-555555555555';
const R1 = 'aaaaaaaa-0000-4000-8000-000000000001', R2 = 'aaaaaaaa-0000-4000-8000-000000000002', GONE = 'aaaaaaaa-0000-4000-8000-0000000000ff';
const titles = { [R1]: 'Invented Bean Hotpot', [R2]: 'Pretend Flatbreads' };
const day = (plan_date, over) => Object.assign({ plan_date, is_blank: false, recipe_ids: [R1], servings: [4], calendar: true, calendar_remind: false }, over || {});
/* The day's events as docs/PLAN-CALENDAR-PUSH.md §12 makes them: up to two, the dishes with the reminder first. */
const eventsOf = (row, groups) => sync.eventsForDay(HH, row, groups || [], titles, 1200);
const tag = id => (id.match(/[rn]$/) || [''])[0];

/* ---- The event's id ---- */
const id = sync.calendarEventId(HH, '2026-10-05');
check('the event id uses only what Google allows (a–v, 0–9, 5 to 1024 long)', /^[a-v0-9]{5,1024}$/.test(id), id);
check('the same household and day always give the same id', id === sync.calendarEventId(HH.toUpperCase(), '2026-10-05'));
check('a different day or household gives a different id',
      id !== sync.calendarEventId(HH, '2026-10-06') && id !== sync.calendarEventId(HH2, '2026-10-05'));
check('the day can be read back from the id, and only from this household\'s',
      sync.dateFromEventId(HH, id) === '2026-10-05' && sync.dateFromEventId(HH2, id) === null && sync.dateFromEventId(HH, 'somethingelse') === null);
/* §12 (20 Oct 2026): a day has two events at most, told apart by a letter after the date. The plain id above is the
   retired one. */
const idR = sync.mealEventId(HH, '2026-10-05', true), idN = sync.mealEventId(HH, '2026-10-05', false);
check('the two ids of a day use only what Google allows, differ from each other and from the retired plain one',
      /^[a-v0-9]{5,1024}$/.test(idR) && /^[a-v0-9]{5,1024}$/.test(idN) && idR === id + 'r' && idN === id + 'n' && new Set([id, idR, idN]).size === 3, idR + ' ' + idN);
check('the day is read back from either of them, and from the retired one; another suffix is not ours',
      [id, idR, idN].every(x => sync.dateFromEventId(HH, x) === '2026-10-05') && sync.dateFromEventId(HH, id + 'x') === null
      && sync.dateFromEventId(HH, id + 'rn') === null && sync.dateFromEventId(HH2, idR) === null);
check('a day\'s ids are the reminder one, the plain one without, and the retired plain id last',
      JSON.stringify(sync.dayEventIds(HH, '2026-10-05')) === JSON.stringify([idR, idN, id]));

/* ---- An all-day event's end, and the reminder ---- */
check('an all-day event ends the next day: across a month, a year, and the clocks going back',
      sync.nextDate('2026-10-31') === '2026-11-01' && sync.nextDate('2026-12-31') === '2027-01-01'
      && sync.nextDate('2026-10-25') === '2026-10-26' && sync.nextDate('2026-03-29') === '2026-03-30' && sync.nextDate('2028-02-28') === '2028-02-29',
      [sync.nextDate('2026-10-31'), sync.nextDate('2026-12-31'), sync.nextDate('2026-10-25')].join(' '));
check('20:00 the evening before is 240 minutes before the day starts; 20:30 is 210',
      sync.reminderMinutes(1200) === 240 && sync.reminderMinutes(1230) === 210, `${sync.reminderMinutes(1200)} ${sync.reminderMinutes(1230)}`);
check('a time that is not a time of day falls back to 20:00',
      [null, undefined, 'x', -1, 1440, 12.5].every(v => sync.reminderMinutes(v) === 240));
check('"today" is the kitchen\'s: 00:30 on a summer night in London is already the new day',
      sync.londonToday(new Date('2026-07-01T23:30:00Z')) === '2026-07-02' && sync.londonToday(new Date('2026-12-01T23:30:00Z')) === '2026-12-01');

/* ---- The event for a day ---- */
const evs = eventsOf(day('2026-10-05', { recipe_ids: [R1, R2], servings: [4, 0] }));
const ev = evs[0];
check('a day switched on as a whole is one event', evs.length === 1, evs.length);
check('titled with the day\'s recipes', ev && ev.summary === 'Invented Bean Hotpot + Pretend Flatbreads', ev && ev.summary);
check('all day: its date, ending the next day, and never marked busy',
      ev && ev.start.date === '2026-10-05' && ev.end.date === '2026-10-06' && !ev.start.dateTime && ev.transparency === 'transparent', JSON.stringify(ev));
check('the description lists each recipe with its servings, then links to the app',
      ev && ev.description.startsWith('Invented Bean Hotpot, for 4\nPretend Flatbreads\n\n') && ev.description.includes('https://crispy-lettuce.github.io/RecipeFlowKeeper/'),
      ev && JSON.stringify(ev.description));
check('with REMIND ME off: no reminder at all, not the calendar\'s default, and it is the "without" event',
      ev && ev.reminders.useDefault === false && ev.reminders.overrides.length === 0 && tag(ev.id) === 'n', ev && JSON.stringify(ev.reminders));
const evR = eventsOf(day('2026-10-05', { calendar_remind: true }))[0];
check('with REMIND ME on: one pop-up, 240 minutes before (20:00 the evening before), and it is the "with" event',
      evR && evR.reminders.useDefault === false && evR.reminders.overrides.length === 1 && tag(evR.id) === 'r'
      && evR.reminders.overrides[0].method === 'popup' && evR.reminders.overrides[0].minutes === 240, evR && JSON.stringify(evR.reminders));
/* PRE-MADE (10 Oct 2026, docs/PLAN-FOOD-DIARY.md): a meal from the freezer says so in the description, and only that one. */
const evPm = eventsOf(day('2026-10-05', { recipe_ids: [R1, R2], servings: [4, 0], premade: ['dinner', ''] }))[0];
check('a pre-made meal says "(from the freezer)" beside its own line only, and the title is unchanged',
      evPm && evPm.description.startsWith('Invented Bean Hotpot, for 4 (from the freezer)\nPretend Flatbreads\n\n')
      && evPm.summary === 'Invented Bean Hotpot + Pretend Flatbreads'
      && !eventsOf(day('2026-10-05'))[0].description.includes('freezer'), evPm && JSON.stringify(evPm.description));
check('the household\'s own reminder time is used', sync.eventsForDay(HH, day('2026-10-05', { calendar_remind: true }), [], titles, 1080)[0].reminders.overrides[0].minutes === 360);
check('a recipe since deleted is left out; a day with none left has no event',
      eventsOf(day('2026-10-05', { recipe_ids: [GONE, R2], servings: [2, 2] }))[0].summary === 'Pretend Flatbreads'
      && eventsOf(day('2026-10-05', { recipe_ids: [GONE] })).length === 0);

/* ---- A reminder per meal (docs/PLAN-CALENDAR-PUSH.md §12, 20 Oct 2026) ---- */
const two = { recipe_ids: [R1, R2], servings: [4, 2], calendar_remind: true };
const mixed = eventsOf(day('2026-10-05', Object.assign({ calendar_items: ['remind', 'in'] }, two)));
check('one dish with the reminder and one without make two events: the reminder one first, each titled with its own dishes',
      mixed.length === 2 && tag(mixed[0].id) === 'r' && tag(mixed[1].id) === 'n'
      && mixed[0].summary === 'Invented Bean Hotpot' && mixed[1].summary === 'Pretend Flatbreads', JSON.stringify(mixed.map(e => e.summary + tag(e.id))));
check('only the first carries the pop-up; the other carries no reminder at all, and neither is marked busy',
      mixed[0].reminders.overrides.length === 1 && mixed[0].reminders.overrides[0].minutes === 240
      && mixed[1].reminders.useDefault === false && mixed[1].reminders.overrides.length === 0 && mixed.every(e => e.transparency === 'transparent'));
check('each lists only its own dishes, with servings, and links to the app',
      mixed[0].description.startsWith('Invented Bean Hotpot, for 4\n\n') && !mixed[0].description.includes('Flatbreads')
      && mixed[1].description.startsWith('Pretend Flatbreads, for 2\n\n') && !mixed[1].description.includes('Hotpot')
      && mixed.every(e => e.description.includes('https://crispy-lettuce.github.io/RecipeFlowKeeper/')));
check('a pre-made dish says so in whichever event it falls in',
      eventsOf(day('2026-10-05', Object.assign({ calendar_items: ['in', 'remind'], premade: ['', 'dinner'] }, two)))[0].description.startsWith('Pretend Flatbreads, for 2 (from the freezer)\n\n'));
check('a dish left out (empty slot) is in neither event',
      JSON.stringify(eventsOf(day('2026-10-05', Object.assign({ calendar_items: ['', 'in'] }, two))).map(e => e.summary + '/' + tag(e.id))) === '["Pretend Flatbreads/n"]'
      && JSON.stringify(eventsOf(day('2026-10-05', Object.assign({ calendar_items: ['remind', ''] }, two))).map(e => e.summary + '/' + tag(e.id))) === '["Invented Bean Hotpot/r"]');
check('with the day itself switched off nothing is written, whatever the dishes say',
      eventsOf(day('2026-10-05', Object.assign({ calendar_items: ['remind', 'remind'], calendar: false }, two))).length === 0);
check('a day saved before the column (or by a tab that does not know it) reads from its two flags: every dish in, or every dish reminded',
      eventsOf(day('2026-10-05', two)).length === 1 && tag(eventsOf(day('2026-10-05', two))[0].id) === 'r'
      && eventsOf(day('2026-10-05', two))[0].summary === 'Invented Bean Hotpot + Pretend Flatbreads'
      && tag(eventsOf(day('2026-10-05', Object.assign({}, two, { calendar_remind: false })))[0].id) === 'n'
      && eventsOf(day('2026-10-05', Object.assign({ calendar_items: [] }, two))).length === 1
      && eventsOf(day('2026-10-05', Object.assign({ calendar_items: ['', ''] }, two)))[0].summary === 'Invented Bean Hotpot + Pretend Flatbreads');
check('a slot that is neither "in" nor "remind" is off; a short list leaves the dishes beyond it off',
      JSON.stringify(sync.dishStates(day('2026-10-05', Object.assign({ calendar_items: ['yes', 'remind'] }, two)), [])) === '[0,2]'
      && JSON.stringify(sync.dishStates(day('2026-10-05', Object.assign({ calendar_items: ['remind'] }, two)), [])) === '[2,0]');
const grp = (date, ids) => ({ date_iso: date, recipe_ids: ids });
check('a group is one meal: its dishes take the strongest of their states, so it is never split across the two events',
      JSON.stringify(sync.dishStates(day('2026-10-05', Object.assign({ calendar_items: ['remind', 'in'] }, two)), [grp('2026-10-05', [R1, R2])])) === '[2,2]'
      && JSON.stringify(sync.dishStates(day('2026-10-05', Object.assign({ calendar_items: ['in', ''] }, two)), [grp('2026-10-05', [R1, R2])])) === '[1,1]'
      && eventsOf(day('2026-10-05', Object.assign({ calendar_items: ['remind', 'in'] }, two)), [grp('2026-10-05', [R1, R2])]).length === 1);
check('a group on another day, or of one dish, changes nothing',
      JSON.stringify(sync.dishStates(day('2026-10-05', Object.assign({ calendar_items: ['remind', 'in'] }, two)), [grp('2026-10-06', [R1, R2]), grp('2026-10-05', [R1])])) === '[2,1]');
const R3 = 'aaaaaaaa-0000-4000-8000-000000000003';
check('a dish outside the group keeps its own state beside it',
      JSON.stringify(sync.dishStates(day('2026-10-05', { recipe_ids: [R1, R2, R3], servings: [2, 2, 2], calendar_remind: false, calendar_items: ['remind', 'in', 'in'] }),
        [grp('2026-10-05', [R1, R2])])) === '[2,2,1]');

/* ---- What a sync does ---- */
const today = '2026-10-05';
const base = { household: HH, titles, remindAt: 1200, today };
/* One word a day: the events it writes (with which of the two they are), or "delete" when it only removes. */
const ops = acts => {
  const dates = [...new Set(acts.map(a => a.date))];
  return dates.map(d => { const puts = acts.filter(a => a.date === d && a.op === 'put'); return puts.length ? `put:${d}/${puts.map(a => tag(a.id)).join('')}` : `delete:${d}`; }).join(' ');
};
const rows = [day('2026-10-05'), day('2026-10-06', { calendar: false }), day('2026-10-07', { is_blank: true }),
  day('2026-10-08', { recipe_ids: [GONE] }), day('2026-10-04')];
const asked = sync.syncActions(Object.assign({}, base, { rows, dates: ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'] }));
check('days asked about: switched on gets written; off, away, emptied or not planned get deleted; the past is left alone',
      ops(asked) === 'put:2026-10-05/n delete:2026-10-06 delete:2026-10-07 delete:2026-10-08 delete:2026-10-09', ops(asked));
check('each action names one of that day\'s event ids, and a write carries the event with that id',
      asked.every(a => sync.dayEventIds(HH, a.date).includes(a.id)) && asked.filter(a => a.op === 'put').every(a => a.event.id === a.id));
const dayActs = d => asked.filter(a => a.date === d).map(a => `${a.op}:${tag(a.id) || 'plain'}`).join(' ');
check('a day written as the "without" event deletes the "with" one and the retired plain id, after the write',
      dayActs('2026-10-05') === 'put:n delete:r delete:plain', dayActs('2026-10-05'));
check('a day that is not wanted deletes every id it could have had: both events and the retired plain one',
      dayActs('2026-10-06') === 'delete:r delete:n delete:plain' && dayActs('2026-10-09') === 'delete:r delete:n delete:plain', dayActs('2026-10-06'));
const splitRows = [day('2026-10-05', { recipe_ids: [R1, R2], servings: [4, 2], calendar_items: ['remind', 'in'] })];
const splitActs = sync.syncActions(Object.assign({}, base, { rows: splitRows, dates: ['2026-10-05'] }));
check('a day with both kinds writes both events and removes only the retired plain id',
      splitActs.map(a => `${a.op}:${tag(a.id) || 'plain'}`).join(' ') === 'put:r put:n delete:plain', splitActs.map(a => `${a.op}:${tag(a.id) || 'plain'}`).join(' '));
const groupedActs = sync.syncActions(Object.assign({}, base, { rows: splitRows, groups: [grp('2026-10-05', [R1, R2])], dates: ['2026-10-05'] }));
check('and the same day with the two dishes grouped writes one event, with the reminder',
      groupedActs.map(a => `${a.op}:${tag(a.id) || 'plain'}`).join(' ') === 'put:r delete:n delete:plain');
check('only the days asked about are touched', ops(sync.syncActions(Object.assign({}, base, { rows, dates: ['2026-10-06'] }))) === 'delete:2026-10-06');
const pastActs = sync.syncActions(Object.assign({}, base, { rows, dates: ['2026-10-04'] }));
check('the past is never rewritten, whatever ids it has', pastActs.length === 0);
const stray = sync.calendarEventId(HH, '2026-10-20'), other = sync.calendarEventId(HH2, '2026-10-21');
const all = sync.syncActions(Object.assign({}, base, { rows, all: true, existingIds: [stray, other, sync.calendarEventId(HH, '2026-10-05'), 'someoneselsesevent'] }));
check('SYNC NOW: every day from today, plus deleting this household\'s events that no longer match, and nothing else',
      ops(all) === 'put:2026-10-05/n delete:2026-10-06 delete:2026-10-07 delete:2026-10-08 delete:2026-10-20', ops(all));
check('    and an event of the new kind, left over on a day that has no row, is found by its date and deleted with the rest',
      ops(sync.syncActions(Object.assign({}, base, { rows, all: true, existingIds: [sync.mealEventId(HH, '2026-10-22', true)] }))).includes('delete:2026-10-22'));
check('    and it removes the retired plain id of a day it rewrites, which is how the first SYNC NOW converts the calendar',
      all.filter(a => a.date === '2026-10-05').some(a => a.op === 'delete' && a.id === sync.calendarEventId(HH, '2026-10-05')));
/* The October review, F38 (12 Oct 2026): SYNC NOW stops 400 days out; a day further ahead is still written when the
   app sends its date. */
const edge = sync.lastAllDate(today);
const farRows = [day('2026-10-05'), day(edge), day(sync.nextDate(edge))];
const farIds = [sync.calendarEventId(HH, edge), sync.calendarEventId(HH, sync.nextDate(edge))];
const far = sync.syncActions(Object.assign({}, base, { rows: farRows, all: true, existingIds: farIds }));
check('SYNC NOW reaches 400 days ahead and no further, for planned days and stray events alike',
      edge === '2027-11-09' && ops(far) === `put:2026-10-05/n put:${edge}/n`, edge + ' ' + ops(far));
check('    while a day beyond that is still written when it is asked about by date',
      ops(sync.syncActions(Object.assign({}, base, { rows: farRows, dates: [sync.nextDate(edge)] }))) === `put:${sync.nextDate(edge)}/n`);
{
  const src = fs.readFileSync(path.join(FUNCS, 'calendar-sync', 'index.ts'), 'utf8');
  const handler = src.slice(src.indexOf('/* ---- end pure ---- */'));
  const loop = handler.slice(handler.indexOf('const deadline'), handler.indexOf('await note({ last_sync_at'));
  check('the Planner read and the calendar listing stop at the same day',
        /q\.gte\('plan_date', today\)\.lte\('plan_date', lastAllDate\(today\)\)/.test(handler)
        && /timeMax: nextDate\(lastAllDate\(today\)\)/.test(handler));
  check('the groups are read for the same days as the plan, and handed to the sync',
        /from\('meal_groups'\)\.select\('date_iso, recipe_ids'\)\.eq\('household_id', household\)/.test(handler)
        && /gq\.gte\('date_iso', today\)\.lte\('date_iso', lastAllDate\(today\)\)/.test(handler)
        && /gq\.in\('date_iso', ask\.dates!\)/.test(handler) && /groups: groupRows \?\? \[\]/.test(handler));
  check('the sync stops sending inside a time budget, counts what is left, and always records how it went',
        /if \(Date\.now\(\) > deadline\) \{ unsent = /.test(loop) && /: unsent \?/.test(handler)
        && /const SYNC_BUDGET_MS = 100_000;/.test(src) && loop.length > 0);
}

/* ---- What the app may ask for ---- */
check('a list of real dates is accepted, in order, without repeats',
      JSON.stringify(sync.parseSyncRequest({ dates: ['2026-10-06', '2026-10-05', '2026-10-06'] })) === '{"dates":["2026-10-05","2026-10-06"]}');
check('everything is { all: true }', sync.parseSyncRequest({ all: true }).all === true);
const bad = [null, {}, { dates: [] }, { dates: ['2026-02-30'] }, { dates: ['5 Oct'] }, { dates: [20261005] },
  { dates: Array.from({ length: 63 }, (_, i) => sync.nextDate('2026-10-01').slice(0, 8) + String(1 + (i % 28)).padStart(2, '0')) }, { all: 'yes' }];
const let_through = bad.filter(b => !sync.parseSyncRequest(b).error);
check('and nothing else: no dates, a date that does not exist, not a date, too many', let_through.length === 0, JSON.stringify(let_through));

/* ---- Connecting ---- */
const consent = new URL(auth.consentUrl({ clientId: 'made-up-client.apps.googleusercontent.com',
  redirectUri: 'https://example.supabase.co/functions/v1/calendar-auth/callback', state: 'abc123',
  scope: 'https://www.googleapis.com/auth/calendar.app.created' }));
const qp = consent.searchParams;
check('the consent link is Google\'s, asking for a lasting token and a fresh one each time',
      consent.origin === 'https://accounts.google.com' && qp.get('access_type') === 'offline' && qp.get('prompt') === 'consent'
      && qp.get('response_type') === 'code' && qp.get('state') === 'abc123', consent.toString());
check('for the app\'s own calendars only, and the account\'s email, and nothing more',
      qp.get('scope').split(' ').sort().join(' ') === 'email https://www.googleapis.com/auth/calendar.app.created openid', qp.get('scope'));
/* Since 10 Oct 2026 the connection also asks for Drive, for the weekly backup (drive-backup): only drive.file, the
   files the app makes, and never the whole Drive. */
const askedScope = new URL(auth.consentUrl({ clientId: 'c', redirectUri: 'https://example.supabase.co/cb', state: 's',
  scope: auth.requestedScope('https://www.googleapis.com/auth/calendar.app.created') })).searchParams.get('scope');
check('connecting asks for the app\'s own calendars and the app\'s own Drive files, and nothing wider',
      askedScope.split(' ').sort().join(' ') === 'email https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/drive.file openid', askedScope);
check('the way back is the app\'s own page, with any old hash dropped',
      auth.safeReturnTo('https://crispy-lettuce.github.io/RecipeFlowKeeper/#settings') === 'https://crispy-lettuce.github.io/RecipeFlowKeeper/'
      && auth.safeReturnTo('http://localhost:8000/index.html') === 'http://localhost:8000/index.html');
const away = ['https://evil.example/', 'https://crispy-lettuce.github.io.evil.example/', 'http://crispy-lettuce.github.io/',
  'https://user:pw@crispy-lettuce.github.io/', 'javascript:alert(1)', '', null].filter(u => auth.safeReturnTo(u) !== null);
check('and nowhere else', away.length === 0, away.join(', '));
check('the outcome goes back as a hash', auth.withOutcome('https://crispy-lettuce.github.io/RecipeFlowKeeper/#x', 'connected')
      === 'https://crispy-lettuce.github.io/RecipeFlowKeeper/#calendar=connected');
const jwt = (claims) => ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');
/* The nonce makes the token's middle part carry both - and _, which base64url has and plain base64 has not. */
const idTok = jwt({ email: 'someone.made.up@example.com', sub: '1', nonce: '??>>~~' });
check('the account\'s email is read from Google\'s id_token, which is base64url',
      /[-_]/.test(idTok.split('.')[1]) && auth.emailFromIdToken(idTok) === 'someone.made.up@example.com', idTok);
check('and a missing or broken one gives none, not an error',
      auth.emailFromIdToken(undefined) === null && auth.emailFromIdToken('a.!!!.c') === null && auth.emailFromIdToken(jwt({ sub: '1' })) === null);
check('connecting needs the calendar permission ticked',
      auth.grantedEnough('openid https://www.googleapis.com/auth/calendar.app.created email')
      && auth.grantedEnough('https://www.googleapis.com/auth/calendar')
      && !auth.grantedEnough('openid email') && !auth.grantedEnough('https://www.googleapis.com/auth/calendar.events') && !auth.grantedEnough(undefined));

/* ---- The October review, 11 Oct 2026 ----
   F7: a row that says connected with no token behind it (after a restore into a new project, where Vault is empty) is
   put right, not left saying connected. F26: Google's callback checks the person who tapped CONNECT is still a member of
   the household before it stores anything. The callback is outside the lifted section, so its order is read from the
   source: the membership read comes before the token exchange. */
check('a connected row with no token is stale; a connected row with one, or a row not connected, is not',
      sync.staleConnection(true, false) === true && sync.staleConnection(true, true) === false && sync.staleConnection(false, false) === false);
{
  const syncSrc = fs.readFileSync(path.join(FUNCS, 'calendar-sync', 'index.ts'), 'utf8');
  const handler = syncSrc.slice(syncSrc.indexOf('/* ---- end pure ---- */'));
  const at = handler.indexOf('if (staleConnection(');
  check('calendar-sync marks such a row not connected, and says to connect again, before refusing',
        at > 0 && /note\(\{ connected: false/.test(handler.slice(at, at + 300)) && /reconnect: true/.test(handler.slice(at, at + 400))
        && at < handler.indexOf("return json({ error: 'Google Calendar is not connected'"));
  const authSrc = fs.readFileSync(path.join(FUNCS, 'calendar-auth', 'index.ts'), 'utf8');
  const cb = authSrc.slice(authSrc.indexOf("here.pathname.endsWith('/callback')"));
  const member = cb.search(/from\('household_members'\)[\s\S]{0,120}\.eq\('user_id', st\.user_id\)\.eq\('household_id', st\.household_id\)/);
  check('the Google callback checks the person is still in the household before it exchanges the code',
        member > 0 && member < cb.indexOf('fetch(GOOGLE_TOKEN_URL') && /if \(!stillMember\) return redirect\(withOutcome\(back, 'denied'\)\)/.test(cb));
}

const failed = checks.filter(c => !c.pass).length;
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
