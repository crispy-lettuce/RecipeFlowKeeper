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

const sync = load('calendar-sync', ['calendarEventId', 'dateFromEventId', 'nextDate', 'reminderMinutes', 'londonToday',
  'eventForDay', 'syncActions', 'parseSyncRequest']);
const auth = load('calendar-auth', ['consentUrl', 'safeReturnTo', 'withOutcome', 'emailFromIdToken', 'grantedEnough', 'requestedScope']);

const HH = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';
const HH2 = '11111111-2222-3333-4444-555555555555';
const R1 = 'aaaaaaaa-0000-4000-8000-000000000001', R2 = 'aaaaaaaa-0000-4000-8000-000000000002', GONE = 'aaaaaaaa-0000-4000-8000-0000000000ff';
const titles = { [R1]: 'Invented Bean Hotpot', [R2]: 'Pretend Flatbreads' };
const day = (plan_date, over) => Object.assign({ plan_date, is_blank: false, recipe_ids: [R1], servings: [4], calendar: true, calendar_remind: false }, over || {});

/* ---- The event's id ---- */
const id = sync.calendarEventId(HH, '2026-10-05');
check('the event id uses only what Google allows (a–v, 0–9, 5 to 1024 long)', /^[a-v0-9]{5,1024}$/.test(id), id);
check('the same household and day always give the same id', id === sync.calendarEventId(HH.toUpperCase(), '2026-10-05'));
check('a different day or household gives a different id',
      id !== sync.calendarEventId(HH, '2026-10-06') && id !== sync.calendarEventId(HH2, '2026-10-05'));
check('the day can be read back from the id, and only from this household\'s',
      sync.dateFromEventId(HH, id) === '2026-10-05' && sync.dateFromEventId(HH2, id) === null && sync.dateFromEventId(HH, 'somethingelse') === null);

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
const ev = sync.eventForDay(HH, day('2026-10-05', { recipe_ids: [R1, R2], servings: [4, 0] }), titles, 1200);
check('titled with the day\'s recipes', ev && ev.summary === 'Invented Bean Hotpot + Pretend Flatbreads', ev && ev.summary);
check('all day: its date, ending the next day, and never marked busy',
      ev && ev.start.date === '2026-10-05' && ev.end.date === '2026-10-06' && !ev.start.dateTime && ev.transparency === 'transparent', JSON.stringify(ev));
check('the description lists each recipe with its servings, then links to the app',
      ev && ev.description.startsWith('Invented Bean Hotpot, for 4\nPretend Flatbreads\n\n') && ev.description.includes('https://crispy-lettuce.github.io/RecipeFlowKeeper/'),
      ev && JSON.stringify(ev.description));
check('with REMIND ME off: no reminder at all, not the calendar\'s default',
      ev && ev.reminders.useDefault === false && ev.reminders.overrides.length === 0, ev && JSON.stringify(ev.reminders));
const evR = sync.eventForDay(HH, day('2026-10-05', { calendar_remind: true }), titles, 1200);
check('with REMIND ME on: one pop-up, 240 minutes before (20:00 the evening before)',
      evR && evR.reminders.useDefault === false && evR.reminders.overrides.length === 1
      && evR.reminders.overrides[0].method === 'popup' && evR.reminders.overrides[0].minutes === 240, evR && JSON.stringify(evR.reminders));
check('the household\'s own reminder time is used', sync.eventForDay(HH, day('2026-10-05', { calendar_remind: true }), titles, 1080).reminders.overrides[0].minutes === 360);
check('a recipe since deleted is left out; a day with none left has no event',
      sync.eventForDay(HH, day('2026-10-05', { recipe_ids: [GONE, R2], servings: [2, 2] }), titles, 1200).summary === 'Pretend Flatbreads'
      && sync.eventForDay(HH, day('2026-10-05', { recipe_ids: [GONE] }), titles, 1200) === null);

/* ---- What a sync does ---- */
const today = '2026-10-05';
const base = { household: HH, titles, remindAt: 1200, today };
const ops = acts => acts.map(a => `${a.op}:${a.date}`).join(' ');
const rows = [day('2026-10-05'), day('2026-10-06', { calendar: false }), day('2026-10-07', { is_blank: true }),
  day('2026-10-08', { recipe_ids: [GONE] }), day('2026-10-04')];
const asked = sync.syncActions(Object.assign({}, base, { rows, dates: ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'] }));
check('days asked about: switched on gets written; off, away, emptied or not planned get deleted; the past is left alone',
      ops(asked) === 'put:2026-10-05 delete:2026-10-06 delete:2026-10-07 delete:2026-10-08 delete:2026-10-09', ops(asked));
check('each action names that day\'s event id', asked.every(a => a.id === sync.calendarEventId(HH, a.date)) && asked[0].event.id === asked[0].id);
check('only the days asked about are touched', ops(sync.syncActions(Object.assign({}, base, { rows, dates: ['2026-10-06'] }))) === 'delete:2026-10-06');
const stray = sync.calendarEventId(HH, '2026-10-20'), other = sync.calendarEventId(HH2, '2026-10-21');
const all = sync.syncActions(Object.assign({}, base, { rows, all: true, existingIds: [stray, other, sync.calendarEventId(HH, '2026-10-05'), 'someoneselsesevent'] }));
check('SYNC NOW: every day from today, plus deleting this household\'s events that no longer match, and nothing else',
      ops(all) === 'put:2026-10-05 delete:2026-10-06 delete:2026-10-07 delete:2026-10-08 delete:2026-10-20', ops(all));

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

const failed = checks.filter(c => !c.pass).length;
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
