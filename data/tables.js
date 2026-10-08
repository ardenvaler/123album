/*
 * Tables — paste CSV straight in (easiest), or give columns + rows.
 *
 *   { type: 'table', title, date, project, keywords, csv: `Col A,Col B\n1,2` }
 *   { type: 'table', title, columns: ['A','B'], rows: [[1,2],[3,4]] }
 *   { type: 'table', title, rows: [{A:1,B:2}, …] }            // objects work too
 *
 * Every table is analysed automatically: totals, averages, peaks, trends,
 * category shares, outliers and empty cells. Numbers like "$12,400", "38%",
 * "1.2K" are understood.
 *
 * SAMPLE DATA — replace with your own.
 */
Atlas.add(
  {
    type: 'table', title: 'Monthly Revenue 2026', date: '2026-10-03',
    keywords: ['revenue', 'finance', 'monthly'],
    csv: `Month,Revenue,Costs,New customers
Jan 2026,$82000,$61000,34
Feb 2026,$86500,$60200,31
Mar 2026,$91200,$63800,42
Apr 2026,$88900,$64100,38
May 2026,$97400,$66500,47
Jun 2026,$104300,$69900,51
Jul 2026,$112800,$71200,58
Aug 2026,$109500,$72800,49
Sep 2026,$118200,$74100,61`
  },
  {
    type: 'table', title: 'Q3 Spend by Team', date: '2026-10-05', project: 'Q4 Budget Planning',
    keywords: ['spend', 'teams', 'q3'],
    columns: ['Team', 'Category', 'Spend', 'Hours'],
    rows: [
      ['Engineering', 'People', 182000, 4120],
      ['Engineering', 'Software', 26400, ''],
      ['Design', 'People', 64000, 1480],
      ['Design', 'Software', 9800, ''],
      ['Marketing', 'Campaigns', 71500, 960],
      ['Marketing', 'People', 58000, 1310],
      ['Data', 'People', 77000, 1720],
      ['Data', 'Software', 31200, ''],
      ['Operations', 'People', 42000, 990]
    ]
  },
  {
    type: 'table', title: 'Apollo Sprint Velocity', date: '2026-10-07', project: 'Apollo Platform',
    keywords: ['sprints', 'velocity', 'story points'],
    rows: [
      { Sprint: 'Sprint 1', Planned: 34, Completed: 28, Bugs: 6 },
      { Sprint: 'Sprint 2', Planned: 36, Completed: 31, Bugs: 5 },
      { Sprint: 'Sprint 3', Planned: 38, Completed: 37, Bugs: 3 },
      { Sprint: 'Sprint 4', Planned: 40, Completed: 33, Bugs: 9 },
      { Sprint: 'Sprint 5', Planned: 40, Completed: 39, Bugs: 4 },
      { Sprint: 'Sprint 6', Planned: 42, Completed: 41, Bugs: 2 }
    ]
  }
);
