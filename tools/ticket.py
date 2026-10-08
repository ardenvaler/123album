#!/usr/bin/env python3
"""Close / reopen / edit / delete reminders and to-dos by ticket number, then rebuild, commit, push.

    python3 tools/ticket.py <bundle_out.html> close  T-001 [T-002 …]
    python3 tools/ticket.py <bundle_out.html> reopen T-001
    python3 tools/ticket.py <bundle_out.html> edit   T-001 '{"due": "2026-10-13", "time": "15:00"}'
    python3 tools/ticket.py <bundle_out.html> delete T-001

Ticket numbers are accepted as T-001, t1, 1 or #1. In `edit`, a value of null removes that field.
After this, publish <bundle_out.html> to the live link with the Artifact tool.
"""
import datetime
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quick_add import ROOT, ship  # noqa: E402


def norm(t):
    return 'T-%03d' % int(re.sub(r'\D', '', t))


def find(ticket):
    for f in sorted((ROOT / 'data').glob('*.js')):
        lines = f.read_text().split('\n')
        for i, line in enumerate(lines):
            if '"ticket": "%s"' % ticket in line:
                return f, lines, i
    sys.exit('ticket %s not found' % ticket)


def main():
    out, action, rest = sys.argv[1], sys.argv[2], sys.argv[3:]
    patch = json.loads(rest.pop()) if action == 'edit' else None
    done = []
    for t in map(norm, rest):
        f, lines, i = find(t)
        line = lines[i].rstrip()
        comma = line.endswith(',')
        entry = json.loads(line.rstrip(','))
        if action == 'delete':
            del lines[i]
            # keep the list valid: the new last entry must not end with a comma
            j = i - 1
            if not comma and j >= 0 and lines[j].rstrip().endswith(','):
                lines[j] = lines[j].rstrip()[:-1]
        else:
            if action == 'close':
                entry['status'] = 'done'
                entry['closed'] = datetime.date.today().isoformat()
            elif action == 'reopen':
                entry.pop('status', None); entry.pop('closed', None)
            elif action == 'edit':
                for k, v in patch.items():
                    if v is None: entry.pop(k, None)
                    else: entry[k] = v
            lines[i] = '  ' + json.dumps(entry, ensure_ascii=False) + (',' if comma else '')
        f.write_text('\n'.join(lines))
        done.append('%s %s' % (t, entry.get('title', '')))
    ship(out, '%s %s' % (action.capitalize(), ', '.join(done)))
    print(action, '->', '; '.join(done))


if __name__ == '__main__':
    main()
