/* Brings the household's Google Calendar into step with the Planner.
 *
 * WHAT IT IS FOR: the Planner says what is for dinner on which day; the
 * calendar on the household's phones is what reminds them. Above all the
 * evening before ("get it out of the freezer"), which is why the event is
 * an all-day one with a reminder at 20:00 the night before, and not a
 * timed meal: the calendar is for reminders, not a food diary (the diary is
 * recipe_logs). The design and the household's answers are
 * docs/PLAN-CALENDAR-PUSH.md §9.
 *
 * WHAT IT DOES: for each day asked about, all-day events in the
 * RecipeWrangler calendar for the dishes of the day that are switched on
 * (IN CALENDAR), none otherwise. A day has at most two: one for the dishes
 * with the reminder and one for those without, and a group of dishes cooked
 * together is never split across them (docs/PLAN-CALENDAR-PUSH.md §12). It
 * reads the day from the database and never trusts what the browser sends,
 * so a stale tab can ask for any date and the answer is still the saved
 * plan. An event's id is worked out from the household, the date and which
 * of the two it is, so there is no table of which event is which and a
 * retry can never make a second event.
 *
 *   await sb.functions.invoke('calendar-sync', { body: { dates: ['2026-10-05'] } });
 *   await sb.functions.invoke('calendar-sync', { body: { all: true } });   // every day from today: SYNC NOW
 *
 * Errors come back as 200 with an `error` field, as the other functions do:
 * supabase-js hides a non-2xx body in error.context, and the app reads
 * `data`. `reconnect: true` means Google no longer accepts the connection.
 *
 * The Google token is in Vault and reached only through the service-role
 * functions in docs/migrations/add-calendar-push.md. Deploy with JWT
 * verification on. Needs the secrets GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET (Edge Functions → Secrets), never in this repo.
 *
 * Added 1 Oct 2026, P3 PR 1.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
/* The platform stops a function at 150 s of wall clock on this plan; the sync stops sending at 100 s so it can always
   write down how far it got (the October review, F38). */
const SYNC_BUDGET_MS = 100_000;
const APP_URL = 'https://crispy-lettuce.github.io/RecipeFlowKeeper/';

const ALLOWED_ORIGIN = /^https:\/\/crispy-lettuce\.github\.io$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  if (!ALLOWED_ORIGIN.test(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

type PlanRow = { plan_date: string; is_blank: boolean; recipe_ids: string[]; servings: number[]; calendar: boolean; calendar_remind: boolean; premade?: string[];
  calendar_items?: string[] };
type GroupRow = { date_iso: string; recipe_ids: string[] };
type SyncInput = { household: string; rows: PlanRow[]; groups?: GroupRow[]; titles: Titles; remindAt: number; today: string;
  dates?: string[]; all?: boolean; existingIds?: string[] };
type EventBody = Record<string, unknown>;
type SyncAction = { op: 'put' | 'delete'; id: string; date: string; event?: EventBody };
type Titles = Record<string, string>;
// deno-lint-ignore no-explicit-any
type Body = any;
type DayItem = { title: string; serves: number; frozen: boolean; remind: boolean };
type SyncRequest = { dates?: string[]; all?: boolean; error?: string };
/* The pure section below keeps every parameter's type to one name, with no
   commas or braces in it: test/calendar-push.js strips the types with the
   same three patterns as test/source-ingredients.js, and those patterns
   are deliberately simple. */

/* ---- pure: lifted and tested by test/calendar-push.js ---- */

const MAX_DATES = 62;
/* How far ahead SYNC NOW ({ all: true }) reaches (the October review, F38). It walks every planned day from today
   with one Google call or two each, plus every stray event of ours; with no end, a plan far enough ahead could run
   the function into the platform's time limit before it recorded how the sync went. 400 days is more than a year of
   planning; a day further out is still written when it changes, through the dates the app sends then. */
const ALL_DAYS_AHEAD = 400;

/* Google's event ids may use only base32hex: the digits and a to v. So the
   prefix is "meal" (no w), then the household's id without its dashes
   (hex, so inside the alphabet), then the date's digits. Stable, so the
   same day always names the same event; unique per household and date.
   This plain id was the day's only event until docs/PLAN-CALENDAR-PUSH.md
   §12 (20 Oct 2026); it is retired now and only ever deleted. */
function calendarEventId(household: string, date: string): string {
  return 'meal' + String(household).toLowerCase().replace(/-/g, '') + String(date).replace(/-/g, '');
}
/* A day's two events: the dishes with the reminder ("r") and those without ("n"). Both letters are inside a to v. */
function mealEventId(household: string, date: string, remind: boolean): string {
  return calendarEventId(household, date) + (remind ? 'r' : 'n');
}
/* Every id a day's event can have, the retired plain one last. */
function dayEventIds(household: string, date: string): string[] {
  return [mealEventId(household, date, true), mealEventId(household, date, false), calendarEventId(household, date)];
}
function eventIdPrefix(household: string): string {
  return 'meal' + String(household).toLowerCase().replace(/-/g, '');
}
function dateFromEventId(household: string, id: string): string | null {
  const prefix = eventIdPrefix(household);
  if (!String(id).startsWith(prefix)) return null;
  const m = String(id).slice(prefix.length).match(/^(\d{4})(\d{2})(\d{2})[rn]?$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function isIsoDate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/* An all-day event ends on the next day, exclusive. Worked in UTC, where
   every day is 24 hours, so the clocks changing cannot move it. */
function nextDate(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* The last day SYNC NOW reaches, counted the same way. */
function lastAllDate(today: string): string {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + ALL_DAYS_AHEAD);
  return d.toISOString().slice(0, 10);
}

/* Google times a reminder in minutes before the event starts, and an
   all-day event starts at 00:00 on its day in the calendar's time zone
   (Europe/London). So 20:00 the evening before is 1440 − 1200 = 240.
   Anything that is not a time of day falls back to 20:00, as asked. */
function reminderMinutes(remindAt: unknown): number {
  const at = typeof remindAt === 'number' && Number.isInteger(remindAt) && remindAt >= 0 && remindAt < 1440 ? remindAt : 1200;
  return 1440 - at;
}

/* Today in the kitchen's own time zone: between midnight and 01:00 in
   summer, UTC is still on yesterday. */
function londonToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/* What each dish of the day is set to: 0 not in the calendar, 1 in it, 2 in it with the reminder. The day's own
   `calendar` is the gate (it is "some dish is in", and a tab that does not know the per-dish column still switches the
   whole day off by clearing it). Inside it, `calendar_items` holds one slot per dish: '' / 'in' / 'remind'. A day with no
   dish marked there was saved before docs/migrations/add-calendar-items.md, or by a tab that does not know the column, and
   its two flags speak for every dish. The app keeps the members of a group equal; this does not trust that, so a group
   changed elsewhere still gets one reminder: the strongest of its members' (§12.3). */
function dishStates(row: PlanRow, groups: GroupRow[]): number[] {
  const ids = row.recipe_ids || [];
  if (!row.calendar) return ids.map(() => 0);
  const slots = ids.map((_rid, i) => { const v = (row.calendar_items || [])[i]; return v === 'remind' ? 2 : v === 'in' ? 1 : 0; });
  const states = slots.some(n => n > 0) ? slots : ids.map(() => (row.calendar_remind ? 2 : 1));
  for (const g of groups || []) {
    if (g.date_iso !== row.plan_date) continue;
    const members: number[] = [];
    ids.forEach((rid, i) => { if ((g.recipe_ids || []).includes(rid)) members.push(i); });
    if (members.length < 2) continue;
    const top = Math.max(...members.map(i => states[i]));
    for (const i of members) states[i] = top;
  }
  return states;
}

/* The day's events, none when there is nothing to show (nothing switched on, or every recipe on it since deleted),
   otherwise one for the dishes with the reminder and one for the rest, whichever there are. Transparent, so they never
   make the household look busy to anyone they share their calendar with. Only the first carries a reminder; the other
   carries none at all, not the calendar's default. A day that is all one state comes out as one event, titled and
   described as the day's only event always was. */
function eventsForDay(household: string, row: PlanRow, groups: GroupRow[], titles: Titles, remindAt: number): EventBody[] {
  const states = dishStates(row, groups);
  const items: DayItem[] = [];
  (row.recipe_ids || []).forEach((rid, i) => {
    const title = titles[rid];
    if (!title || !states[i]) return;
    const n = Number((row.servings || [])[i]);
    /* PRE-MADE (docs/PLAN-FOOD-DIARY.md): a slot holding a meal means this one comes out of the freezer. Before
       docs/migrations/add-premade.md the column is absent, and every item reads as fresh. */
    const frozen = !!(Array.isArray(row.premade) && row.premade[i]);
    items.push({ title: String(title).trim(), serves: Number.isInteger(n) && n > 0 ? n : 0, frozen, remind: states[i] === 2 });
  });
  const events: EventBody[] = [];
  for (const remind of [true, false]) {
    const these = items.filter(it => it.remind === remind);
    if (!these.length) continue;
    /* The description says which come out of the freezer: the evening-before reminder is the one that matters for them.
       The title stays the recipes' names. */
    const description = these.map(it => (it.serves ? `${it.title}, for ${it.serves}` : it.title) + (it.frozen ? ' (from the freezer)' : '')).join('\n')
      + `\n\nPlanned in RecipeWrangler: ${APP_URL}`;
    events.push({
      id: mealEventId(household, row.plan_date, remind),
      summary: these.map(it => it.title).join(' + '),
      description,
      start: { date: row.plan_date },
      end: { date: nextDate(row.plan_date) },
      transparency: 'transparent',
      reminders: { useDefault: false, overrides: remind ? [{ method: 'popup', minutes: reminderMinutes(remindAt) }] : [] },
    });
  }
  return events;
}

/* What to do, given the saved plan. A day from today on that is planned,
   not away and switched on gets its events written (created or brought up
   to date); every other id the day could have is deleted, which is how
   switching off, marking away, emptying a day, a dish moving between the
   two events and the retired plain id all reach the calendar. Writes come
   first on a day, so a reminder is never missing between a delete and the
   write that replaces it. Past days are left as they were: the calendar is
   not rewritten backwards. With `all`, events of this household's in the
   calendar that no longer match a wanted day are deleted too, so SYNC NOW
   also mends anything a missed sync left behind. */
function syncActions(input: SyncInput): SyncAction[] {
  const byDate: Map<string, PlanRow> = new Map();
  for (const r of input.rows || []) byDate.set(r.plan_date, r);
  const wanted: Map<string, EventBody[]> = new Map();
  for (const r of input.rows || []) {
    if (r.plan_date < input.today || r.is_blank || !r.calendar) continue;
    const events = eventsForDay(input.household, r, input.groups || [], input.titles || {}, input.remindAt);
    if (events.length) wanted.set(r.plan_date, events);
  }
  const consider: Set<string> = new Set();
  if (input.all) {
    for (const d of byDate.keys()) consider.add(d);
    for (const id of input.existingIds || []) {
      const d = dateFromEventId(input.household, id);
      if (d) consider.add(d);
    }
  } else {
    for (const d of input.dates || []) consider.add(d);
  }
  const actions: SyncAction[] = [];
  const last = input.all ? lastAllDate(input.today) : '';
  for (const date of [...consider].sort()) {
    if (date < input.today) continue;
    if (last && date > last) continue;
    const events = wanted.get(date) || [];
    const kept: Set<string> = new Set(events.map(e => String(e.id)));
    for (const event of events) actions.push({ op: 'put', id: String(event.id), date, event });
    for (const id of dayEventIds(input.household, date)) if (!kept.has(id)) actions.push({ op: 'delete', id, date });
  }
  return actions;
}

/* What the app may ask for: a list of real dates, or everything. */
function parseSyncRequest(body: Body): SyncRequest {
  const b: Body = body && typeof body === 'object' ? body : {};
  if (b.all === true) return { all: true };
  if (!Array.isArray(b.dates) || !b.dates.length) return { error: 'Give dates or all' };
  if (b.dates.length > MAX_DATES) return { error: `At most ${MAX_DATES} dates at a time` };
  if (!b.dates.every(isIsoDate)) return { error: 'Dates must be YYYY-MM-DD' };
  const dates: string[] = [...new Set(b.dates)].map(String).sort();
  return { dates };
}

/* A connection the row says is live but Vault holds no token for: what a restore into a new project leaves (Vault is
   in no backup), or a token removed by hand. Until 11 Oct 2026 this returned "not connected" and left the row saying
   connected, so Settings kept showing CONNECTED with nothing behind it (the October review, F7). Now the row is put
   right, and Settings offers CONNECT. */
function staleConnection(connected: boolean, hasToken: boolean): boolean {
  return connected === true && !hasToken;
}

/* ---- end pure ---- */

async function googleAccessToken(refreshToken: string): Promise<{ token?: string; invalid?: boolean; error?: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok && j.access_token) return { token: j.access_token };
  /* invalid_grant: revoked in the Google account, or (with the consent
     screen left in Testing) seven days old. Only CONNECT again mends it. */
  if (j.error === 'invalid_grant') return { invalid: true };
  return { error: `Google refused the token: ${j.error ?? res.status}` };
}

async function listOwnEventIds(calendarId: string, token: string, household: string, today: string): Promise<string[]> {
  const ids: string[] = [];
  const prefix = eventIdPrefix(household);
  let pageToken = '';
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ timeMin: today + 'T00:00:00Z', timeMax: nextDate(lastAllDate(today)) + 'T00:00:00Z',
      maxResults: '250', singleEvents: 'true' });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`listing the calendar returned ${res.status}`);
    const j = await res.json();
    for (const e of j.items ?? []) if (String(e.id).startsWith(prefix)) ids.push(e.id);
    pageToken = j.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return ids;
}

/* Insert with our own id; if Google already has that id (409), it is
   either our live event or one deleted earlier, which Google keeps as
   "cancelled". A PUT with status confirmed updates the first and brings
   the second back. */
async function putEvent(calendarId: string, token: string, a: SyncAction): Promise<number> {
  const base = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const ins = await fetch(base, { method: 'POST', headers, body: JSON.stringify(a.event) });
  await ins.body?.cancel();
  if (ins.status !== 409) return ins.status;
  const upd = await fetch(`${base}/${a.id}`, { method: 'PUT', headers, body: JSON.stringify({ ...a.event, status: 'confirmed' }) });
  await upd.body?.cancel();
  return upd.status;
}

async function deleteEvent(calendarId: string, token: string, a: SyncAction): Promise<number> {
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${a.id}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  await res.body?.cancel();
  /* 404: never made. 410: already deleted. Either way the day has no event. */
  return res.status === 404 || res.status === 410 ? 204 : res.status;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (p: unknown, status = 200) =>
    new Response(JSON.stringify(p, null, 2), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'Not signed in' }, 401);

  let body: unknown = {};
  try { body = await req.json(); } catch { /* parseSyncRequest says what is missing */ }
  const ask = parseSyncRequest(body);
  if (ask.error) return json({ error: ask.error }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: hh } = await admin.from('household_members').select('household_id').eq('user_id', user.id);
  const households = (hh ?? []).map(h => h.household_id);
  if (households.length !== 1) return json({ error: 'Calendar sync needs exactly one household for this account' });
  const household = households[0];

  const { data: conn } = await admin.from('calendar_connections').select('connected, calendar_id').eq('household_id', household).maybeSingle();
  const { data: refresh } = await admin.rpc('calendar_token_get', { p_household: household });
  const note = (fields: Record<string, unknown>) =>
    admin.from('calendar_connections').update({ ...fields, updated_at: new Date().toISOString() }).eq('household_id', household);
  if (staleConnection(conn?.connected === true, !!refresh)) {
    await note({ connected: false, last_error: 'The Google connection was lost: CONNECT again in Settings' });
    return json({ error: 'The Google connection was lost', reconnect: true });
  }
  if (!conn?.connected || !conn.calendar_id || !refresh) return json({ error: 'Google Calendar is not connected', notConnected: true });

  const access = await googleAccessToken(refresh);
  if (access.invalid) {
    await note({ connected: false, last_error: 'Google no longer accepts the connection: CONNECT again in Settings' });
    return json({ error: 'Google no longer accepts the connection', reconnect: true });
  }
  if (!access.token) {
    await note({ last_error: access.error });
    return json({ error: access.error });
  }

  const today = londonToday(new Date());
  /* Every column, so `premade` and `calendar_items` are read once their migrations are in, and naming them before then
     cannot break the sync. */
  let q = admin.from('planner_days').select('*').eq('household_id', household);
  q = ask.all ? q.gte('plan_date', today).lte('plan_date', lastAllDate(today)) : q.in('plan_date', ask.dates!);
  const { data: rows, error: rowsErr } = await q;
  if (rowsErr) return json({ error: `could not read the Planner: ${rowsErr.message}` });

  const recipeIds = [...new Set((rows ?? []).flatMap(r => r.recipe_ids ?? []))];
  const titles: Record<string, string> = {};
  if (recipeIds.length) {
    const { data: recipes } = await admin.from('recipes').select('id, title').eq('household_id', household).in('id', recipeIds);
    for (const r of recipes ?? []) titles[r.id] = r.title;
  }
  /* Groups (cooked together, one reminder): read for the same days. A failed read leaves them out; the app keeps a group's
     members equal anyway, and this is only the second line of defence (§12.3). */
  let gq = admin.from('meal_groups').select('date_iso, recipe_ids').eq('household_id', household);
  gq = ask.all ? gq.gte('date_iso', today).lte('date_iso', lastAllDate(today)) : gq.in('date_iso', ask.dates!);
  const { data: groupRows } = await gq;
  const { data: settings } = await admin.from('household_settings').select('calendar_remind_at').eq('household_id', household).maybeSingle();

  let existingIds: string[] = [];
  if (ask.all) {
    try { existingIds = await listOwnEventIds(conn.calendar_id, access.token, household, today); }
    catch (e) { await note({ last_error: String((e as Error).message ?? e) }); return json({ error: String((e as Error).message ?? e) }); }
  }

  const actions = syncActions({ household, rows: rows ?? [], groups: groupRows ?? [], titles, remindAt: settings?.calendar_remind_at ?? 1200, today,
    dates: ask.dates, all: ask.all, existingIds });
  const failed: { date: string; op: string; status: number }[] = [];
  let put = 0, deleted = 0, unsent = 0;
  /* A time budget well inside the platform's limit, so the outcome is always recorded below even when Google is
     slow: what is left is counted and named in last_error, and SYNC NOW again finishes it (F38, 12 Oct 2026). */
  const deadline = Date.now() + SYNC_BUDGET_MS;
  for (const a of actions) {
    if (Date.now() > deadline) { unsent = actions.length - put - deleted - failed.length; break; }
    let status = 0;
    try { status = a.op === 'put' ? await putEvent(conn.calendar_id, access.token, a) : await deleteEvent(conn.calendar_id, access.token, a); }
    catch { status = 0; }
    if (status >= 200 && status < 300) { if (a.op === 'put') put++; else deleted++; }
    else failed.push({ date: a.date, op: a.op, status });
  }
  /* A 404 on the calendar itself means it was deleted in Google: say so in
     words, since only CONNECT again (which makes a new one) mends it. */
  const lastError = failed.some(f => f.status === 404) ? 'The RecipeWrangler calendar is missing in Google: CONNECT again in Settings'
    : failed.length ? `${failed.length} day${failed.length === 1 ? '' : 's'} could not be written (Google said ${failed[0].status || 'nothing'})`
    : unsent ? `Google was slow: ${unsent} day${unsent === 1 ? ' was' : 's were'} not reached. SYNC NOW again to finish`
    : null;
  await note({ last_sync_at: new Date().toISOString(), last_error: lastError });
  return json(lastError ? { error: lastError, put, deleted, failed, unsent } : { ok: true, put, deleted });
});
