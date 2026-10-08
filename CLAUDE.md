# Atlas — notes for Claude

Personal work dashboard (static HTML/CSS/vanilla JS, no build, no dependencies). The owner feeds
data in chat; Claude turns it into entries in `/data`.

## Ingesting data the owner sends

- Put each kind in its file: `data/updates.js`, `tables.js`, `metrics.js`, `reminders.js`,
  `notes.js`, `projects.js`. Format: `data/README.md`.
- **Sample data:** the files currently contain sample entries (marked `SAMPLE DATA` in the header
  comment). When the first real data arrives, ask whether to remove the samples, then remove them all.
- Tables: paste CSV as-is into `csv:` (template literal). Keep the owner's column names.
- Updates: one entry per status sentence. Set `project`, `date`, `status` when stated or obvious.
- Reminders: anything with a date the owner wants to be told about. Use `notify` for lead time and
  `repeat` for recurring things (birthdays → `yearly`).
- Keywords: always include the owner's keywords verbatim, then add 2–4 more from the content
  (client names, deliverables, systems, topics). The app also derives keywords automatically.
- Use ISO dates (`YYYY-MM-DD`). If the owner says "next Friday", resolve it to a date.

## Code map

- `assets/js/core/` — engine: `text.js` (tokenize/stem/synonyms), `dates.js` (NL date ranges),
  `analyze.js` (CSV + table stats), `store.js` (normalize, auto-keywords, index), `query.js`
  (NL search + table math), `reminders.js`, `insights.js`
- `assets/js/ui/` — `charts.js` (SVG), `render.js` (templates), `assistant.js`, `app.js`
- Scripts are classic (not modules) so `index.html` works from `file://`.

## Checking changes

Open with a fixed date: `index.html?today=2026-10-08`. Headless Chromium is available via Playwright
(`executablePath` not needed; browsers live in `/opt/pw-browsers`).
