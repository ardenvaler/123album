#!/usr/bin/env python3
"""Fast path for simple inputs: add entries, rebuild the bundle, commit and push in one step.

    python3 tools/quick_add.py <bundle_out.html> '<json entry or list of entries>' ["commit message"]

Each entry needs a `type` (update, reminder, metric, note, link, table); it is appended to the
matching file in /data. After this, publish <bundle_out.html> to the live link with the Artifact tool.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = {'update': 'updates.js', 'reminder': 'reminders.js', 'todo': 'reminders.js', 'metric': 'metrics.js',
         'note': 'notes.js', 'link': 'notes.js', 'table': 'tables.js'}


def next_ticket():
    """Next ticket number. data/tickets.json remembers the last one so numbers are never reused."""
    counter = ROOT / 'data' / 'tickets.json'
    nums = [int(n) for f in (ROOT / 'data').glob('*.js') for n in re.findall(r'"ticket": "T-(\d+)"', f.read_text())]
    last = max(nums + [json.loads(counter.read_text())['last'] if counter.exists() else 0])
    counter.write_text(json.dumps({'last': last + 1}) + '\n')
    return 'T-%03d' % (last + 1)


def append(entry):
    if entry.get('type') in ('reminder', 'todo'):
        entry['type'] = 'reminder'
        entry = {'type': 'reminder', 'ticket': entry.get('ticket') or next_ticket(),
                 **{k: v for k, v in entry.items() if k not in ('type', 'ticket')}}
    path = ROOT / 'data' / FILES.get(entry.get('type'), 'notes.js')
    src = path.read_text()
    end = src.rstrip().rfind(');')
    body = src[:end].rstrip()
    item = '  ' + json.dumps(entry, ensure_ascii=False)
    sep = '\n' if body.endswith('Metis.add(') else ',\n'
    path.write_text(body + sep + item + '\n);\n')
    return path.name + (' ' + entry['ticket'] if entry.get('ticket') else '')


def main():
    out, raw = sys.argv[1], sys.argv[2]
    msg = sys.argv[3] if len(sys.argv) > 3 else None
    entries = json.loads(raw)
    entries = entries if isinstance(entries, list) else [entries]
    touched = sorted({append(e) for e in entries})
    ship(out, msg or 'Add ' + ', '.join(e.get('title') or e.get('text', '')[:50] for e in entries))
    print('added:', ', '.join(touched))


def ship(out, title):
    """Rebuild the single-file bundle, commit and push."""
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'build_artifact.py'), out], check=True)
    trailer = ('\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'
               'Claude-Session: https://claude.ai/code/session_01C3KUqgeaRr2t2KMWeoLT3H')
    subprocess.run(['git', '-C', str(ROOT), 'add', '-A'], check=True)
    subprocess.run(['git', '-C', str(ROOT), 'commit', '-q', '-m', title + trailer], check=True)
    branch = subprocess.run(['git', '-C', str(ROOT), 'branch', '--show-current'], capture_output=True, text=True).stdout.strip()
    subprocess.run(['git', '-C', str(ROOT), 'push', '-q', 'origin', branch], check=True)
    print('pushed', branch)


if __name__ == '__main__':
    main()
