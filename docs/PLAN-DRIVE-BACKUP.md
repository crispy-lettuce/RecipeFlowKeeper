# A weekly backup to Google Drive

**Asked on 10 Oct 2026**, once Google was connected for the calendar: "now we have google account link up for calendar would it
make sense to save backups/export to google drive?" **Answered the same day:** yes, a weekly copy of the app's own export into the
household's Drive, the export file only; built the same day.

## 1. What there was

Checked read-only on 10 Oct 2026:

- **The real backup:** `PrivateBackup`'s nightly `pg_dump` of every household. It succeeded every day from 5 to 10 Oct. A
  weekly mirror of the `recipe-images` bucket runs beside it.
- **What those lack:**
  - they are in one GitHub account;
  - they are restored by a technical runbook (`PrivateBackup/README.md`);
  - the household never sees them;
  - the private `recipe-sources` bucket (source photos and PDFs) is in neither.
- **EXPORT DATA** downloads a file the household can restore unaided with IMPORT DATA, but only when someone remembers.
- **The Google connection** (`calendar-auth`) asked only for the calendar.

## 2. What was decided

- **The Drive copy is extra; the nightly dump stays the real backup.** It does not replace the dump.
- **The file is the export.** It is the very payload EXPORT DATA downloads (`exportPayload()`), named as the download is
  (`kitchen-backup-YYYY-MM-DD.json`), so IMPORT DATA restores it as it is. Source photos are not copied to Drive. They go into
  `PrivateBackup`'s weekly mirror instead (a small PR there).
- **Where it goes:** a "RecipeWrangler backups" folder in each household's **own** Drive. One file a day: a second save the same
  day replaces that day's file. The newest 8 are kept.
- **When:**
  - **automatically:** on the first load of the app a week or more after the last save, once per page load, and only when
    nothing is waiting to be sent;
  - **by hand:** SAVE TO DRIVE NOW in Settings → APP → BACKUP TO GOOGLE DRIVE.
  - **No server schedule.** A week the app is not opened has nothing new, and the nightly dump covers it.
- **The permission:** `drive.file`, which reaches only the files and folder the app itself makes, never the rest of Drive.
  - `calendar-auth` asks for it beside the calendar.
  - Google's page lets it be unticked: the calendar still connects, and Settings offers CONNECT AGAIN FOR DRIVE.
  - DISCONNECT stops the Drive backup too. Files already in Drive stay there.
- **Not done:**
  - the database dump to Drive, since it needs the database password, which never leaves GitHub's secrets;
  - restoring straight from Drive: download the file, then IMPORT DATA.

## 3. How it is built

- **`supabase/functions/drive-backup`:**
  1. checks the sign-in, one household, and a connection with `drive.file`;
  2. gets a Google token from the refresh token in Vault, as `calendar-sync` does;
  3. finds or makes the folder;
  4. uploads or replaces today's file;
  5. deletes backups beyond 8, and only files with its own name pattern;
  6. records `drive_backup_at`, `drive_last_error` and `drive_folder_id` on `calendar_connections`.
- **The migration:** `docs/migrations/add-drive-backup.md` adds those three columns. Only Edge Functions write that table.
- **The app:**
  - `exportPayload()` is shared by EXPORT DATA and the Drive save;
  - the BACKUP TO GOOGLE DRIVE block;
  - `maybeWeeklyDriveBackup()` after the load and after the tab-return refresh.
- **Tests:**
  - `test/drive-backup.js` (lifted from the function);
  - a check in `test/calendar-push.js` that CONNECT asks for `drive.file` and nothing wider;
  - smoke checks.

## 4. The household's steps, in order

1. **Google Cloud console**, the same project as the calendar:
   1. APIs & Services → Library → **Google Drive API** → **Enable**.
   2. Google Auth platform → Data access → **Add or remove scopes**: tick `…/auth/drive.file` ("See, edit, create and delete only
      the specific Google Drive files you use with this app") → Update → Save.
2. **Supabase SQL editor:** run `docs/migrations/add-drive-backup.md`, then its two check queries.
3. **Edge Functions**, each pasted from its raw GitHub URL on `main` after merging, or on the PR's branch before:
   - **create `drive-backup`**, with JWT verification **on**;
   - **redeploy `calendar-auth`**, with JWT verification still **off**.
4. **Merge the PR.**
5. **On the tablet:** Settings → APP → BACKUP TO GOOGLE DRIVE → CONNECT AGAIN FOR DRIVE. Google asks again: leave both boxes
   ticked, and through "Google hasn't verified this app", as before.
6. **SAVE TO DRIVE NOW**, then look in Google Drive for RecipeWrangler backups. That is tablet step 44a.

If the secret `GOOGLE_CALENDAR_SCOPE` was ever set, nothing changes: Drive is asked for beside whatever it names.
