/*
 * Updates — short sentences about work in progress or finished.
 *
 * Fields: date, project, title (optional — taken from text), text, status,
 *         progress (0–100, optional), people, keywords
 * Status words understood: done/completed/shipped · in progress/ongoing ·
 *         blocked/on hold · at risk/delayed · planned/pending.
 * If status is missing it is inferred from the text ("finished…", "blocked on…").
 *
 * SAMPLE DATA — replace with your own.
 */
Atlas.add(
  {
    type: 'update', date: '2026-10-07', project: 'Apollo Platform',
    text: 'Finished migrating the finance dashboards to the new warehouse. Query times dropped from ~40s to under 5s.',
    status: 'done', progress: 65, keywords: ['migration', 'warehouse', 'performance']
  },
  {
    type: 'update', date: '2026-10-06', project: 'Website Revamp',
    text: 'Homepage design delayed — waiting on final brand assets from the agency. Launch likely slips one week.',
    status: 'at risk', people: ['Priya'], keywords: ['design', 'agency', 'launch']
  },
  {
    type: 'update', date: '2026-10-05', project: 'Q4 Budget Planning',
    text: 'Collected budget requests from all five teams. Engineering is 12% over last quarter; need to discuss with Dana.',
    status: 'in progress', progress: 55, people: ['Dana'], keywords: ['budget', 'requests', 'engineering']
  },
  {
    type: 'update', date: '2026-10-02', project: 'Apollo Platform',
    text: 'Started the data-quality checks for the sales pipeline tables. Found 3 duplicate key issues so far.',
    status: 'in progress', keywords: ['data quality', 'sales pipeline']
  },
  {
    type: 'update', date: '2026-10-01', project: 'Vendor Onboarding',
    text: 'Both analytics vendors signed and onboarded. Access, SSO and billing are all set up.',
    status: 'done', keywords: ['vendors', 'sso', 'contracts']
  },
  {
    type: 'update', date: '2026-09-29', project: 'Website Revamp',
    text: 'CMS content model approved. Started building page templates in the new design system.',
    status: 'in progress', progress: 40, keywords: ['cms', 'templates']
  },
  {
    type: 'update', date: '2026-09-25', project: 'Apollo Platform',
    text: 'Shipped the new ingestion pipeline to production. Nightly loads now finish by 2am.',
    status: 'done', keywords: ['pipeline', 'release']
  },
  {
    type: 'update', date: '2026-09-22', title: 'Quarterly review deck sent',
    text: 'Sent the Q3 review deck to leadership. Feedback session booked for October.',
    status: 'done', keywords: ['q3 review', 'leadership', 'deck']
  },
  {
    type: 'update', date: '2026-09-18', project: 'Vendor Onboarding',
    text: 'Security review for vendor B blocked on missing SOC 2 report.',
    status: 'blocked', keywords: ['security', 'soc2']
  },
  {
    type: 'update', date: '2026-09-12', project: 'Q4 Budget Planning',
    text: 'Kicked off Q4 planning with finance. Template and deadlines shared with team leads.',
    status: 'in progress', people: ['Dana'], keywords: ['finance', 'kickoff']
  },
  {
    type: 'update', date: '2026-09-08', project: 'Website Revamp',
    text: 'Completed user interviews with 8 customers. Navigation and pricing pages are the biggest pain points.',
    status: 'done', keywords: ['research', 'interviews', 'pricing']
  }
);
