/* Tests drive-backup, the Edge Function that saves the household's backup file into its own Google Drive
 * (docs/PLAN-DRIVE-BACKUP.md): which file it accepts, what it names it, which old files it removes, and the upload
 * body it builds.
 *
 * Like calendar-push.js, this lifts the code out of the real function source, the section between the "pure"
 * markers in supabase/functions/drive-backup/index.ts, with its type annotations stripped by the same patterns, so a
 * copy cannot drift and pass while the deployed function fails. If a function goes missing, this throws.
 *
 * Nothing here talks to Google. It proves what the function would send, not that Drive takes it: the household's
 * first SAVE TO DRIVE NOW is that (docs/TEST-PLAN.md, step 44a).
 *
 *   node test/drive-backup.js
 *
 * Added 10 Oct 2026. */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'supabase', 'functions', 'drive-backup', 'index.ts');
const src = fs.readFileSync(FILE, 'utf8');
const from = src.indexOf('/* ---- pure: lifted');
const to = src.indexOf('/* ---- end pure ---- */');
if(from < 0 || to < from) throw new Error('could not find the pure section in ' + FILE);
const js = src.slice(from, to)
  .replace(/function\s+(\w+)\s*\(([^)]*)\)[^\n{]*\{\s*$/gm,
    (_, fname, args) => `function ${fname}(${args.split(',').map(a => a.split(':')[0].trim()).filter(Boolean).join(', ')}) {`)
  .replace(/\(([\w$]+)\s*:\s*[^()]*?\)\s*(:\s*[\w<>|\[\] ]+)?\s*=>/g, '($1) =>')
  .replace(/\b(const|let)\s+([\w$]+)\s*:\s*[^=;\n]+(\s*[=;])/g, '$1 $2$3');
const NAMES = ['hasDriveScope', 'londonToday', 'backupFileName', 'parseBackupRequest', 'planBackupFiles', 'multipartBody'];
const fn = new Function(js + `\nreturn { ${NAMES.join(', ')}, KEEP_FILES, MAX_BYTES };`)();
for(const n of NAMES) if(typeof fn[n] !== 'function') throw new Error(`${n} missing from ${FILE}: checks would be vacuous`);

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail !== undefined && !pass ? '  (' + detail + ')' : ''}`);
};

/* ---- The permission ---- */
check('Drive is allowed only when the connection was granted drive.file',
      fn.hasDriveScope('openid https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/drive.file email')
      && !fn.hasDriveScope('openid https://www.googleapis.com/auth/calendar.app.created email')
      && !fn.hasDriveScope('https://www.googleapis.com/auth/drive.file.extra') && !fn.hasDriveScope(undefined));

/* ---- The file's name ---- */
check('one file per day, named by the kitchen\'s date: 00:30 on a summer night in London is already the new day',
      fn.backupFileName(fn.londonToday(new Date('2026-07-01T23:30:00Z'))) === 'kitchen-backup-2026-07-02.json'
      && fn.backupFileName(fn.londonToday(new Date('2026-12-01T23:30:00Z'))) === 'kitchen-backup-2026-12-01.json');

/* ---- What it accepts ---- */
const backup = { app: 'Kitchen', version: 3, exportedAt: '2026-10-10T16:00:00.000Z', recipes: [{ id: 'r1', title: 'Invented Bean Hotpot' }], diary: [] };
const okReq = fn.parseBackupRequest({ backup });
check('the app\'s own export is stored exactly as EXPORT DATA downloads it (the same JSON, pretty-printed)',
      okReq.text === JSON.stringify(backup, null, 2) && !okReq.error, JSON.stringify(okReq).slice(0, 120));
const refused = [null, {}, { backup: null }, { backup: [] }, { backup: 'text' }, { backup: { app: 'Other', recipes: [] } },
  { backup: { app: 'Kitchen' } }, { backup: { app: 'Kitchen', recipes: 'none' } }].filter(b => !fn.parseBackupRequest(b).error);
check('and nothing that is not one', refused.length === 0, JSON.stringify(refused));
const huge = { app: 'Kitchen', recipes: [{ syntax: 'x'.repeat(fn.MAX_BYTES) }] };
check('a file too large for one upload is refused, not half-sent', /too large/.test(fn.parseBackupRequest({ backup: huge }).error || ''));

/* ---- Which files go ---- */
const f = (id, name) => ({ id, name });
const ten = Array.from({ length: 10 }, (_, i) => f('id' + i, `kitchen-backup-2026-09-${String(10 + i).padStart(2, '0')}.json`));
const p1 = fn.planBackupFiles(ten, 'kitchen-backup-2026-10-10.json');
check(`a new day's file keeps the newest ${fn.KEEP_FILES} in all: the ${10 - (fn.KEEP_FILES - 1)} oldest go, by the date in the name`,
      p1.replaceId === null && JSON.stringify(p1.deleteIds.slice().sort()) === JSON.stringify(['id0', 'id1', 'id2']), JSON.stringify(p1));
const shuffled = [ten[7], ten[2], ten[9], ten[0], ten[5], ten[1], ten[8], ten[3], ten[6], ten[4]];
check('in whatever order Drive lists them', JSON.stringify(fn.planBackupFiles(shuffled, 'kitchen-backup-2026-10-10.json').deleteIds.slice().sort())
      === JSON.stringify(['id0', 'id1', 'id2']));
const p2 = fn.planBackupFiles(ten.concat([f('today', 'kitchen-backup-2026-10-10.json')]), 'kitchen-backup-2026-10-10.json');
check('a second save the same day replaces that day\'s file rather than adding another',
      p2.replaceId === 'today' && !p2.deleteIds.includes('today') && JSON.stringify(p2.deleteIds.slice().sort()) === JSON.stringify(['id0', 'id1', 'id2']),
      JSON.stringify(p2));
const p3 = fn.planBackupFiles([f('a', 'kitchen-backup-2026-10-01.json'), f('b', 'kitchen-backup-2026-10-02.json')], 'kitchen-backup-2026-10-10.json');
check('with fewer than that, nothing goes', p3.replaceId === null && p3.deleteIds.length === 0, JSON.stringify(p3));
const others = ten.concat([f('notes', 'shopping notes.txt'), f('copy', 'kitchen-backup-2026-09-01 (1).json'), f('x', 'kitchen-backup-latest.json')]);
const p4 = fn.planBackupFiles(others, 'kitchen-backup-2026-10-10.json');
check('only files named as the app names its backups are ever removed',
      !p4.deleteIds.some(id => ['notes', 'copy', 'x'].includes(id)) && p4.deleteIds.length === 3, JSON.stringify(p4));

/* ---- The upload ---- */
const body = fn.multipartBody('BOUNDARY', { name: 'kitchen-backup-2026-10-10.json', parents: ['folder1'] }, '{"app":"Kitchen"}');
const parts = body.split('--BOUNDARY');
check('the upload is two parts, the file\'s details then its content, and closes its boundary',
      parts.length === 4 && /application\/json; charset=UTF-8\r\n\r\n\{"name":"kitchen-backup-2026-10-10.json","parents":\["folder1"\]\}/.test(parts[1])
      && /\r\n\r\n\{"app":"Kitchen"\}\r\n$/.test(parts[2]) && parts[3] === '--', JSON.stringify(body));

const failed = checks.filter(c => !c.pass).length;
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
