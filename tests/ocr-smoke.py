"""Run with the OCR Python environment; uses synthetic documents only."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from PIL import Image, ImageDraw, ImageFont

worker = Path(os.environ.get('OCR_WORKER', Path(__file__).resolve().parents[1] / 'server/ocr.py'))
with tempfile.TemporaryDirectory(prefix='nudgewise-ocr-test-') as directory:
    root = Path(directory)
    with Image.new('RGB', (1200, 400), 'white') as image:
        ImageDraw.Draw(image).text((40, 80), 'Example Company\nEmail: buyer@example.com', fill='black', font=ImageFont.load_default(size=36))
        image.save(root / 'customer.png')
        image.save(root / 'customer.pdf', 'PDF')
        image.save(root / 'too-many-pages.pdf', 'PDF', save_all=True, append_images=[image] * 5)
    for filename in ['customer.png', 'customer.pdf']:
        result = subprocess.run([sys.executable, str(worker), str(root / filename)], capture_output=True, text=True, timeout=180)
        assert result.returncode == 0, result.stderr
        assert 'Example Company' in result.stdout and 'buyer@example.com' in result.stdout, result.stdout
        print(f'{filename}: text extraction passed', flush=True)
    result = subprocess.run([sys.executable, str(worker), str(root / 'too-many-pages.pdf')], capture_output=True, text=True, timeout=180)
    assert result.returncode != 0 and 'exceeds five pages' in result.stderr, result.stderr
    print('Six-page PDF: rejected', flush=True)
    with (root / 'oversized.png').open('wb') as output:
        output.truncate(10 * 1024 * 1024 + 1)
    result = subprocess.run([sys.executable, str(worker), str(root / 'oversized.png')], capture_output=True, text=True, timeout=30)
    assert result.returncode != 0 and 'exceeds 10 MiB' in result.stderr, result.stderr
    print('Oversized file: rejected', flush=True)
