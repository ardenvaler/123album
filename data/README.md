# Data format

Each file in this folder calls `Metis.add({...}, {...})` with one or more entries. Files are plain
JavaScript so the dashboard works when opened straight from disk (no server needed).

Every entry can have these common fields. All of them are optional except what makes the entry useful.

| Field | Meaning |
|---|---|
| `type` | `update` · `table` · `metric` · `reminder` · `note` · `link`, or anything else (shown as a generic card) |
| `title` | Short name. For updates it can be omitted; the first sentence of `text` is used |
| `text` | Free text (sentences, notes) |
| `date` | `'2026-10-08'` (also accepts `'Oct 8 2026'`, `'2026/10/08'`) |
| `project` | Project name. Projects are created automatically from this |
| `status` | `done` · `in progress` · `blocked` · `at risk` · `planned` (and common synonyms) |
| `keywords` | `['budget', 'q4']`, your own search keywords. Automatic ones are added too |
| `people` | `['Dana']` |
| `id` | Optional stable id (lets reminders watch a metric) |
| `pinned` | `true` to float it up in search |

## update

```js
{ type: 'update', date: '2026-10-07', project: 'Apollo Platform',
  text: 'Finished migrating the finance dashboards.', status: 'done', progress: 65,
  keywords: ['migration'] }
```

If `status` is missing it is inferred from the text ("finished…", "blocked on…", "started…").

## table

```js
{ type: 'table', title: 'Monthly Revenue', date: '2026-10-03', csv: `Month,Revenue,Costs
Jan 2026,$82000,$61000
Feb 2026,$86500,$60200` }

{ type: 'table', title: 'Spend', columns: ['Team', 'Spend'], rows: [['Design', 64000], ['Data', 77000]] }

{ type: 'table', title: 'Velocity', rows: [{ Sprint: 'Sprint 1', Completed: 28 }, …] }
```

Numbers like `$12,400`, `38%`, `1.2K`, `(500)` are understood. Month or sprint columns are treated
as ordered, so trends are computed.

## metric

```js
{ type: 'metric', id: 'open-tickets', title: 'Open support tickets', value: 37,
  history: [22, 25, 24, 29, 31, 37], target: 30, better: 'lower', unit: '' }
```

## reminder

```js
{ type: 'reminder', title: 'Submit Q3 report', due: '2026-10-09', time: '09:00',
  notify: 5,            // start showing 5 days before (default 3)
  repeat: 'none',       // daily | weekly | biweekly | monthly | quarterly | yearly
  priority: 'high' }

{ type: 'reminder', title: 'Escalate support backlog',
  condition: { metric: 'open-tickets', above: 35 } }   // or below / equals
```

## note / link / anything else

```js
{ type: 'note', title: 'Idea', text: '…', date: '2026-10-04' }
{ type: 'link', title: 'Architecture doc', url: 'https://…' }
{ type: 'contact', name: 'Dana Lee', text: 'Finance partner', phone: '…' }  // generic card
```

## projects.js (optional)

```js
Metis.project({ name: 'Apollo Platform', aliases: ['Apollo'], description: '…',
                status: 'in progress', progress: 65, owner: 'Me' })
```

Aliases let searches like "apollo" find the project.
