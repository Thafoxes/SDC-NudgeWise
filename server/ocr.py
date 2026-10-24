"""Isolated, bounded Docling worker. Stdout contains only the extracted text."""
import sys
from pathlib import Path
from contextlib import redirect_stdout
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

with redirect_stdout(sys.stderr):
    source = Path(sys.argv[1])
    if source.stat().st_size > 10 * 1024 * 1024:
        raise ValueError('Document exceeds 10 MiB')
    if '--tables' in sys.argv:
        from docling.document_converter import DocumentConverter, PdfFormatOption, ImageFormatOption
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions

        options = PdfPipelineOptions(do_ocr=True, do_table_structure=True)
        options.ocr_options = RapidOcrOptions()
        converter = DocumentConverter(format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=options),
            InputFormat.IMAGE: ImageFormatOption(pipeline_options=options),
        })
        result = converter.convert(str(source), max_num_pages=5, max_file_size=10 * 1024 * 1024)
        text = result.document.export_to_markdown()
    else:
        # Text-only intake avoids Docling's layout model on memory-limited hosts.
        import numpy as np
        from PIL import Image
        from rapidocr import RapidOCR

        engine = RapidOCR()
        def read_image(image):
            result = engine(np.asarray(image.convert('RGB')))
            return '\n'.join(result.txts or [])

        if source.suffix.lower() == '.pdf':
            import pypdfium2 as pdfium
            with pdfium.PdfDocument(str(source)) as document:
                if len(document) > 5:
                    raise ValueError('Document exceeds five pages')
                pages = []
                for page in document:
                    with page:
                        bitmap = page.render(scale=1.5)
                        try:
                            with bitmap.to_pil() as image:
                                pages.append(read_image(image))
                        finally:
                            bitmap.close()
                text = '\n\n'.join(pages)
        else:
            with Image.open(source) as image:
                text = read_image(image)

if not text.strip() or len(text) > 30000:
    raise ValueError('Receipt text is empty or exceeds 30000 characters')
print(text)
