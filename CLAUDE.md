# Metis — notes for Claude

Personal work dashboard (static HTML/CSS/vanilla JS, no build, no dependencies). The owner feeds
data in chat; Claude turns it into entries in `/data`.

## Live dashboard link — always share it

The dashboard is published as a private claude.ai artifact:
**https://claude.ai/artifact/3G2iJeYJr3XUJoWU3sEUrF**

After **every** change (data or code): rebuild the single-file bundle with
`python3 tools/build_artifact.py <scratchpad>/metis.html`, republish it to that URL with the Artifact
tool (pass the URL as `url`; read it first if this session hasn't), commit + push, and give the owner
the link in the reply.

## Simple inputs — keep token use minimal (owner's request)

For a simple sentence (a reminder, a status update, a datapoint, a note), do exactly this and nothing
more: no file reads, no screenshots, no tests, no questions unless a date is truly ambiguous.

1. One Bash call: `python3 tools/quick_add.py <scratchpad>/metis.html '<entry JSON>'`
   (appends to the right data file, rebuilds the bundle, commits and pushes).
2. One Artifact publish of `<scratchpad>/metis.html` to the live URL.
3. Reply in 1–2 lines: what was added (date resolved) + the link.

Tickets (reminders and to-dos only): `quick_add.py` assigns the next `T-NNN` automatically; a
to-do is `{"type": "todo", "title": …}` (a reminder with no date). To act on one, single Bash call:
`python3 tools/ticket.py <scratchpad>/metis.html close|reopen|delete T-001 [T-002…]` or
`… edit T-001 '{"due": "2026-10-13", "time": null}'` (null removes a field), then publish + 1-line reply.
Entries in data files stay one JSON object per line so these tools can edit them.

Use the full workflow (read files, verify in a browser) only for code changes or large/table data.

## Ingesting data the owner sends

- Put each kind in its file: `data/updates.js`, `tables.js`, `metrics.js`, `reminders.js`,
  `notes.js`, `projects.js`. Format: `data/README.md`.
- **Sample data:** removed on 2026-10-08 at the owner's request; all entries in `/data` are real.
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
