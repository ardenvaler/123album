/*
 * Reminders — pop up as banners when their condition is met.
 *
 * Fields: title, due ('2026-10-12' or '2026-10-12T14:30'), time ('14:30'),
 *         notify: days before `due` to start showing it (default 3),
 *         repeat: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly',
 *         condition: { metric: '<metric id>', above: N }  (or below / equals),
 *         priority: 'high' | 'normal', project, text, keywords
 *
 * "Done" / "Snooze" on a banner are remembered in this browser.
 *
 * SAMPLE DATA — replace with your own.
 */
Metis.add(
  {
    type: 'reminder', title: 'Pay vendor B invoice', due: '2026-10-06', project: 'Vendor Onboarding',
    text: 'Invoice #4471 — net 30.', priority: 'high', keywords: ['invoice', 'finance']
  },
  {
    type: 'reminder', title: '1:1 with Dana', due: '2026-10-08', time: '15:00',
    text: 'Bring Q4 budget numbers and the engineering overage.', people: ['Dana'], keywords: ['1:1', 'budget']
  },
  {
    type: 'reminder', title: 'Submit Q3 report', due: '2026-10-09', notify: 5, priority: 'high',
    text: 'Final numbers + narrative to leadership.', keywords: ['report', 'q3']
  },
  {
    type: 'reminder', title: 'Weekly team sync', due: '2026-09-07', time: '10:00', repeat: 'weekly', notify: 1,
    keywords: ['meeting', 'team']
  },
  {
    type: 'reminder', title: 'Website launch go/no-go', due: '2026-10-16', project: 'Website Revamp', notify: 7,
    keywords: ['launch', 'decision']
  },
  {
    type: 'reminder', title: 'Acme contract renewal', due: '2026-10-30', notify: 21,
    text: 'Decide on renewal terms before the auto-renew date.', keywords: ['contract', 'renewal', 'acme']
  },
  {
    type: 'reminder', title: 'Maya’s birthday', due: '2026-10-15', repeat: 'yearly', notify: 7,
    keywords: ['personal', 'birthday']
  },
  {
    type: 'reminder', title: 'Escalate support backlog',
    text: 'If open tickets go above 35, bring it up in the ops review.',
    condition: { metric: 'open-tickets', above: 35 }, keywords: ['support', 'escalation']
  },
  {
    type: 'reminder', title: 'Book Q4 offsite venue', due: '2026-11-12', notify: 14,
    keywords: ['offsite', 'planning']
  }
);
