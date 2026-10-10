/* Saves the household's backup file into its own Google Drive.
 *
 * WHY: the nightly database dump (PrivateBackup) is the real backup, but it lives in GitHub and is restored by a
 * runbook. This is a second copy the household can see and restore unaided: the very file EXPORT DATA downloads and
 * IMPORT DATA restores, kept in a "RecipeWrangler backups" folder in their own Drive. Asked for on 10 Oct 2026, once
 * the Google connection existed for the calendar (docs/PLAN-DRIVE-BACKUP.md).
 *
 *   await sb.functions.invoke('drive-backup', { body: { backup: <the exportAllData payload> } });
 *
 * The app builds the file, so its format is the export's and cannot drift from what IMPORT DATA reads. This function
 * only puts it in Drive: one file per day, kitchen-backup-YYYY-MM-DD.json, the name EXPORT DATA gives its download (a
 * second save the same day replaces that day's file), and the newest KEEP_FILES kept. It deletes only files of that name pattern, and with the drive.file
 * permission it can see nothing in Drive but the files and folder it made.
 *
 * It uses the Google connection calendar-auth made, which asks for drive.file beside the calendar since 10 Oct. A
 * household connected before then, or that unticked Drive on Google's page, has no Drive permission: this says so
 * (noScope), and the app offers CONNECT again. Its outcome is written to calendar_connections (drive_backup_at,
 * drive_last_error, drive_folder_id), which only Edge Functions write (docs/migrations/add-drive-backup.md).
 *
 * Errors come back as 200 with an `error` field, as the other functions do. Deploy with JWT verification on. Needs
 * the secrets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, already set for the calendar.
 *
 * Added 10 Oct 2026.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = 'RecipeWrangler backups';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

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

type DriveFile = { id: string; name: string };
type FilePlan = { replaceId: string | null; deleteIds: string[] };
type BackupRequest = { text?: string; error?: string };
// deno-lint-ignore no-explicit-any
type Body = any;
/* As in calendar-sync: in the pure section each parameter's type is one name with no commas or braces, so
   test/drive-backup.js can strip the types with the same simple patterns. */

/* ---- pure: lifted and tested by test/drive-backup.js ---- */

const KEEP_FILES = 8;
const MAX_BYTES = 4 * 1024 * 1024;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILE_PATTERN = /^kitchen-backup-\d{4}-\d{2}-\d{2}\.json$/;

/* Whether the connection's granted permissions include Drive. Google lists them space-separated. */
function hasDriveScope(scope: unknown): boolean {
  return String(scope || '').split(/\s+/).includes(DRIVE_SCOPE);
}

/* The kitchen's date, not the server's: a save at 00:30 on a summer night in London belongs to the new day. */
function londonToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function backupFileName(today: string): string {
  return `kitchen-backup-${today}.json`;
}

/* Only a file the app's own EXPORT DATA could have made, and small enough for one upload. Returns the text to store,
   pretty-printed as the download is, so the two are the same file. */
function parseBackupRequest(body: Body): BackupRequest {
  const b: Body = body && typeof body === 'object' ? body.backup : null;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'No backup was sent' };
  if (b.app !== 'Kitchen' || !Array.isArray(b.recipes)) return { error: 'That is not a backup from this app' };
  const text = JSON.stringify(b, null, 2);
  if (new TextEncoder().encode(text).length > MAX_BYTES) return { error: 'The backup is too large to save to Drive' };
  return { text };
}

/* Given the backup files already in the folder: whether today's file replaces one of the same name, and which
   older ones go so that KEEP_FILES remain. Only names the app gives its backups are ever considered. */
function planBackupFiles(existing: DriveFile[], name: string): FilePlan {
  const ours = (existing || []).filter(f => f && FILE_PATTERN.test(String(f.name)));
  const same = ours.filter(f => f.name === name);
  const replaceId = same.length ? same[0].id : null;
  /* Duplicates of today's name beyond the one replaced go too; then the oldest, by the date in the name. */
  const extras = same.slice(1).map(f => f.id);
  const others = ours.filter(f => f.name !== name).sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
  const old = others.slice(Math.max(0, KEEP_FILES - 1)).map(f => f.id);
  return { replaceId, deleteIds: extras.concat(old) };
}

/* One multipart/related body: the file's details, then its content, as Drive's simple multipart upload takes them. */
function multipartBody(boundary: string, metadata: Body, text: string): string {
  return `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    + `--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
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
  if (j.error === 'invalid_grant') return { invalid: true };
  return { error: `Google refused the token: ${j.error ?? res.status}` };
}

/* The folder the app made before, if it is still there and not in the bin; otherwise a new one. */
async function backupFolder(token: string, knownId: string | null): Promise<string> {
  const auth = { Authorization: `Bearer ${token}` };
  if (knownId) {
    const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(knownId)}?fields=id,trashed`, { headers: auth });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.id && !j.trashed) return j.id;
  }
  const made = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const j = await made.json().catch(() => ({}));
  if (!made.ok || !j.id) throw new Error(`Drive would not make the folder (${made.status})`);
  return j.id;
}

async function listBackups(token: string, folderId: string): Promise<DriveFile[]> {
  const q = new URLSearchParams({ q: `'${folderId}' in parents and trashed = false`, fields: 'files(id,name)', pageSize: '100' });
  const res = await fetch(`${DRIVE_API}/files?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive would not list the folder (${res.status})`);
  const j = await res.json();
  return (j.files ?? []).map((f: DriveFile) => ({ id: f.id, name: f.name }));
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (p: unknown, status = 200) =>
    new Response(JSON.stringify(p, null, 2), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Not found' }, 404);

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'Not signed in' }, 401);

  let body: unknown = {};
  try { body = await req.json(); } catch { /* parseBackupRequest says what is missing */ }
  const ask = parseBackupRequest(body);
  if (ask.error) return json({ error: ask.error }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: hh } = await admin.from('household_members').select('household_id').eq('user_id', user.id);
  const households = (hh ?? []).map(h => h.household_id);
  if (households.length !== 1) return json({ error: 'Drive backup needs exactly one household for this account' });
  const household = households[0];

  const { data: conn } = await admin.from('calendar_connections').select('connected, scope, drive_folder_id')
    .eq('household_id', household).maybeSingle();
  const { data: refresh } = await admin.rpc('calendar_token_get', { p_household: household });
  if (!conn?.connected || !refresh) return json({ error: 'Google is not connected', notConnected: true });
  if (!hasDriveScope(conn.scope)) return json({ error: 'Google was connected without Drive: CONNECT again to allow it', noScope: true });

  const note = (fields: Record<string, unknown>) =>
    admin.from('calendar_connections').update({ ...fields, updated_at: new Date().toISOString() }).eq('household_id', household);

  const access = await googleAccessToken(refresh);
  if (access.invalid) {
    await note({ connected: false, last_error: 'Google no longer accepts the connection: CONNECT again in Settings' });
    return json({ error: 'Google no longer accepts the connection', reconnect: true });
  }
  if (!access.token) {
    await note({ drive_last_error: access.error });
    return json({ error: access.error });
  }
  const auth = { Authorization: `Bearer ${access.token}` };

  try {
    const folderId = await backupFolder(access.token, conn.drive_folder_id ?? null);
    const name = backupFileName(londonToday(new Date()));
    const plan = planBackupFiles(await listBackups(access.token, folderId), name);

    const boundary = 'recipewrangler' + crypto.randomUUID().replace(/-/g, '');
    const metadata = plan.replaceId ? { name } : { name, parents: [folderId], mimeType: 'application/json' };
    const target = plan.replaceId
      ? `${DRIVE_UPLOAD}/files/${encodeURIComponent(plan.replaceId)}?uploadType=multipart&fields=id,name`
      : `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name`;
    const up = await fetch(target, {
      method: plan.replaceId ? 'PATCH' : 'POST',
      headers: { ...auth, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody(boundary, metadata, ask.text!),
    });
    const saved = await up.json().catch(() => ({}));
    if (!up.ok || !saved.id) throw new Error(`Drive would not take the file (${up.status})`);

    /* Tidying is best effort: a file that will not delete now goes next time. */
    let deleted = 0;
    for (const id of plan.deleteIds) {
      const del = await fetch(`${DRIVE_API}/files/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth }).catch(() => null);
      await del?.body?.cancel();
      if (del && (del.ok || del.status === 404)) deleted++;
    }
    const at = new Date().toISOString();
    await note({ drive_folder_id: folderId, drive_backup_at: at, drive_last_error: null });
    return json({ ok: true, name, at, deleted });
  } catch (e) {
    const message = String((e as Error).message ?? e);
    await note({ drive_last_error: message });
    return json({ error: message });
  }
});
