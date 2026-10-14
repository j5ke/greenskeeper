"""Build a Pages artifact containing public files only."""
from pathlib import Path
import shutil
from build import ROOT, build

output = ROOT / '_site'
if output.exists():
    shutil.rmtree(output)
build(output=output)
for folder in ('assets', 'images'):
    shutil.copytree(ROOT / folder, output / folder)
for name in ('privacy.html', 'terms.html', 'support.html', 'CNAME'):
    if (ROOT / name).exists():
        shutil.copy2(ROOT / name, output / name)
print('Public Pages artifact ready in _site/.')

# Tracking activates only in the production artifact, on the two approved hostnames.
public_pages = sorted(output.rglob('*.html'))
routes = [('/' if page.relative_to(output).as_posix() == 'index.html' else '/' + page.relative_to(output).as_posix().removesuffix('index.html')) for page in public_pages]
for page in public_pages:
    html = page.read_text()
    if 'src="assets/analytics.js"' not in html and 'assets/analytics.js' not in html:
        html = html.replace('</head>', '<script defer src="/assets/analytics.js"></script></head>')
    html = html.replace('</head>', '<meta name="analytics-environment" content="production"><meta name="analytics-routes" content="' + ','.join(routes) + '"></head>')
    page.write_text(html)
