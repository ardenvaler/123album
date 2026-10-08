/*
 * Projects (optional). Projects are also discovered automatically from the
 * `project` field of any entry — list them here only to add a description,
 * owner, aliases, explicit status or progress.
 *
 * SAMPLE DATA — replace with your own.
 */
Atlas.project(
  {
    name: 'Apollo Platform',
    aliases: ['Apollo'],
    description: 'Migration of the legacy reporting stack to the new data platform.',
    owner: 'Me',
    status: 'in progress',
    progress: 65
  },
  {
    name: 'Website Revamp',
    aliases: ['website', 'site redesign'],
    description: 'New marketing site, design system and CMS migration.',
    status: 'at risk',
    progress: 40
  },
  {
    name: 'Q4 Budget Planning',
    aliases: ['budget', 'q4 plan'],
    description: 'Consolidate team requests and land the Q4 budget with finance.',
    status: 'in progress',
    progress: 55
  },
  {
    name: 'Vendor Onboarding',
    aliases: ['vendors'],
    description: 'Onboard the two new analytics vendors.',
    status: 'done'
  }
);
