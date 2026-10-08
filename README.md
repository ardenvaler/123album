# Atlas — personal control center

A personal work dashboard you can open straight from disk. It has an Apple-keynote-style landing page,
natural-language search, quick analysis of tables, reminders that pop up when they come due, and an
assistant that briefs you on your data and suggests what to ask.

**Live link (private):** https://claude.ai/artifact/3G2iJeYJr3XUJoWU3sEUrF

**No build step, no server, no dependencies.** Open `index.html` in a browser, or publish the repo
with GitHub Pages. Search runs entirely in your browser.

## What's on the landing page

| Tile | What it shows |
|---|---|
| **Next up** | The most urgent reminder with a countdown ring, plus the next few |
| **Atlas noticed** | Rotating insights: overdue items, metrics off target, biggest movers, quiet projects, recent wins |
| **This week** | Updates logged, wins, reminders due soon, active projects |
| **Projects** | Status and progress for each project, discovered automatically |
| **Latest** | Your most recent updates and notes |
| **Key numbers** | Metrics with change, sparkline and target status |
| **Data** | The newest table's headline figure, trend and main insight |

## Search (plain English)

Type in the big search bar (`⌘K` or `/` to focus). It shows what it understood as chips while you type.

| You type | It does |
|---|---|
| `what's due this week`, `overdue`, `reminders next 14 days` | Reminders filtered by date |
| `updates last week`, `done in September`, `Q3`, `since August` | Time ranges on any entry |
| `Apollo`, `Apollo progress`, `blocked projects` | Project lookup + status |
| `total revenue`, `average hours by team`, `top 3 teams by spend` | Math on your tables, with a chart |
| `revenue trend`, `costs by month`, `how much did we spend` | Trends and totals |
| `how many updates this month` | Counts |
| `metrics off target`, `invoce` (typo) | Status filters; typo-tolerant |

Synonyms are built in (for example *sales ≈ revenue*, *spend ≈ cost*, *meeting ≈ sync*). Words close to
your data are corrected ("Did you mean…").

## Assistant

Click **Ask Atlas** (or `⌘J`). It answers the same questions conversationally and also handles:

- `brief me` / `what needs my attention`: a prioritized briefing
- `remind me to send the deck on Friday at 9am`: creates a reminder (saved in this browser)
- `note: …`, `log: …`, `done: …`: quick capture, filed under the right project automatically
- `export`: copies everything captured in the browser as code you can paste into `/data`
- `enable notifications`, `dark mode`, `help`

## Reminders

Reminders slide in as banners when their condition is met: *n* days before the due date, on the day,
at a set time, while overdue, or when a watched metric crosses a threshold. After a few seconds they
tuck into the bell in the top bar. **Done** and **Later** (snooze for a day) are remembered per
occurrence. Repeating reminders (weekly, monthly, yearly and so on) roll forward automatically.

## Keywords

Your own `keywords` are used first. Atlas also derives keywords from the content:

- names, products and acronyms (capitalized words mid-sentence), plus `#hashtags`
- the most distinctive words in each entry (TF-IDF across all your data)
- table column names and their most common category values
- status (done, blocked…), month, year, quarter, and on/off target for metrics

Auto-keywords appear as lighter chips in each entry's detail view, and all of them are searchable.

## Tables

Paste CSV into `data/tables.js` (or drop a `.csv` anywhere on the page for a one-off analysis). Each
table gets totals or averages, a peak and a low, first-to-last trend, category share, outliers and
empty-cell checks. It also gets a chart you can switch between numeric columns, and a sortable data view.

## Adding your data

All data lives in [`/data`](data/), one file per kind. The format is documented in
[`data/README.md`](data/README.md). The files currently hold **sample data** to replace.

## Files

```
index.html               page shell
assets/css/style.css     design system (light + dark)
assets/js/core/          engine: text, dates, analysis, store, query, reminders, insights
assets/js/ui/            charts, templates, assistant, app controller
data/                    your data
tools/build_artifact.py  bundles everything into one HTML file for the live link
```

Tip: add `?today=2026-10-08` to the URL to preview the dashboard as of another date.
