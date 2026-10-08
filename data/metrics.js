/*
 * Metrics — quick numbers / datapoints.
 *
 * Fields: title, value, unit ('$', '%', 'ms', 'users'…), date, project,
 *         history: [older … newer]  (draws a sparkline + computes change)
 *         previous: number          (alternative to history)
 *         target: number, better: 'higher' | 'lower'
 *         id (optional, lets reminders watch this metric)
 *
 * SAMPLE DATA — replace with your own.
 */
Metis.add(
  {
    type: 'metric', id: 'active-users', title: 'Active users', value: 12480, date: '2026-10-07',
    history: [9100, 9600, 10200, 10050, 10900, 11400, 11800, 12480], target: 12000,
    keywords: ['users', 'growth', 'engagement']
  },
  {
    type: 'metric', id: 'nps', title: 'NPS', value: 42, date: '2026-10-01',
    history: [38, 41, 39, 44, 46, 42], target: 50,
    keywords: ['customer satisfaction', 'survey']
  },
  {
    type: 'metric', id: 'open-tickets', title: 'Open support tickets', value: 37, date: '2026-10-08',
    history: [22, 25, 24, 29, 31, 37], target: 30, better: 'lower',
    keywords: ['support', 'backlog']
  },
  {
    type: 'metric', id: 'budget-used', title: 'Annual budget used', value: 71, unit: '%', date: '2026-10-05',
    project: 'Q4 Budget Planning', history: [18, 27, 36, 44, 52, 60, 66, 71], target: 75, better: 'lower',
    keywords: ['budget', 'burn']
  },
  {
    type: 'metric', id: 'pipeline-runtime', title: 'Nightly pipeline runtime', value: 48, unit: 'min', date: '2026-10-07',
    project: 'Apollo Platform', history: [132, 118, 96, 71, 55, 48], better: 'lower',
    keywords: ['pipeline', 'performance']
  }
);
