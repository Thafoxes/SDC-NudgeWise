"""Isolated, bounded Docling worker. Stdout contains only the extracted text."""
import sys
from contextlib import redirect_stdout
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

with redirect_stdout(sys.stderr):
    from docling.document_converter import DocumentConverter, PdfFormatOption, ImageFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions

    options = PdfPipelineOptions(do_ocr=True, do_table_structure='--tables' in sys.argv)
    options.ocr_options = RapidOcrOptions()
    converter = DocumentConverter(format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=options),
        InputFormat.IMAGE: ImageFormatOption(pipeline_options=options),
    })
    result = converter.convert(sys.argv[1], max_num_pages=5, max_file_size=10 * 1024 * 1024)
    text = result.document.export_to_markdown()

if not text.strip() or len(text) > 30000:
    raise ValueError('Receipt text is empty or exceeds 30000 characters')
print(text)
