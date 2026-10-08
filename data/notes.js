/*
 * Notes, links and anything else.
 *
 *   { type: 'note', title, text, date, project, keywords }
 *   { type: 'link', title, url, text, keywords }
 *
 * Any other `type` is also accepted and shown as a generic card, so you can
 * add things like { type: 'contact', name, text } without changing code.
 *
 * SAMPLE DATA — replace with your own.
 */
Metis.add(
  {
    type: 'note', date: '2026-10-04', project: 'Apollo Platform', title: 'Idea: self-serve report builder',
    text: 'Once the migration is done, a self-serve report builder could remove ~30% of ad-hoc requests. Ask Priya for design time in Q1.',
    keywords: ['idea', 'self-serve', 'reporting']
  },
  {
    type: 'note', date: '2026-09-30', title: 'Budget meeting takeaways',
    text: 'Finance wants all Q4 requests by Oct 17. Headcount requests need a one-page justification. Software renewals reviewed separately.',
    keywords: ['budget', 'meeting', 'finance']
  },
  {
    type: 'link', date: '2026-09-15', title: 'Apollo architecture doc', url: 'https://example.com/apollo-architecture',
    project: 'Apollo Platform', text: 'Source of truth for the new platform design.', keywords: ['architecture', 'docs']
  }
);
