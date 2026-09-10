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
