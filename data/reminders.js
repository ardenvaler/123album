/*
 * Reminders — pop up as banners when their condition is met.
 *
 * Fields: title, due ('2026-10-12' or '2026-10-12T14:30'), time ('14:30'),
 *         notify: days before `due` to start showing it (default 3),
 *         repeat: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly',
 *         condition: { metric: '<metric id>', above: N }  (or below / equals),
 *         priority: 'high' | 'normal', project, text, keywords
 *         ticket: 'T-001' (assigned automatically; reminders and to-dos only)
 *         A to-do is a reminder with no `due` date.
 *         One entry per line (tools/ticket.py edits them by ticket number).
 *
 * "Done" / "Snooze" on a banner are remembered in this browser.
 */

Metis.add(
  {"type": "reminder", "ticket": "T-001", "title": "Discuss M&A transition scheme with the team", "due": "2026-10-12", "time": "13:00", "notify": 3, "text": "Monday afternoon: talk through the M&A transition scheme with the team.", "keywords": ["MnA", "M&A", "transition scheme", "team discussion", "mergers and acquisitions"]}
);
