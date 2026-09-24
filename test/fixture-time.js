/* The one date the offline harness runs on.
 *
 * build.js dates every fixture row from it, and smoke.js freezes the page's
 * clock to it, so "today", "tomorrow" and "this week" mean the same thing in
 * the data and in the app whatever day the suite is actually run.
 *
 * WHY: until 24 Sep 2026 the fixture used the real clock — planned days at
 * today and tomorrow — and the app's week starts on Friday. So every
 * Thursday, tomorrow fell into next week, the shopping list rightly left it
 * out, and two checks went red with the code untouched. It was found at four
 * minutes past midnight, when a run that had been green all evening failed on
 * its own. A Tuesday morning: no week boundary within a day of it in either
 * direction, and the diary's "cooked -7 days" lands on a Tuesday too.
 *
 * Local time on purpose (not an ISO string with a Z): the app builds its day
 * keys from local dates, and so does build.js's iso(). */
module.exports = { FIXTURE_NOW: new Date(2026, 8, 22, 9, 0, 0) };
