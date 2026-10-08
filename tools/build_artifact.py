#!/usr/bin/env python3
"""Bundle the dashboard into one self-contained HTML file (CSS, JS and data inlined).

Used to publish the private claude.ai preview link:
    python3 tools/build_artifact.py /path/to/metis.html
The output omits <html>/<head>/<body> because the artifact host adds its own skeleton.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(out):
    html = (ROOT / 'index.html').read_text()
    head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
    body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)

    # Drop metas the host skeleton already provides
    head = re.sub(r'\s*<meta (charset|name="viewport")[^>]*>', '', head)

    def inline_css(m):
        return '<style>\n' + (ROOT / m.group(1)).read_text() + '\n</style>'

    def inline_js(m):
        src = (ROOT / m.group(1)).read_text().replace('</script', '<\\/script')
        return '<script>/* ' + m.group(1) + ' */\n' + src + '\n</script>'

    head = re.sub(r'<link rel="stylesheet" href="(assets/[^"]+)">', inline_css, head)
    body = re.sub(r'<script src="([^"]+)"></script>', inline_js, body)
    Path(out).write_text(head.strip() + '\n' + body.strip() + '\n')
    print('wrote', out, round(Path(out).stat().st_size / 1024), 'KB')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'metis.html')
