"""Optional local QA tooling; not an application/backend dependency."""
import json
from pathlib import Path

import pymupdf
from pypdf import PdfReader

folder = Path(__file__).resolve().parents[2] / "output" / "pdf"
report = []
for name in ["quotation-sample", "workshop-sample", "quotation-long-logo", "workshop-pagination-test"]:
    source = folder / f"{name}.pdf"
    reader = PdfReader(source)
    document = pymupdf.open(source)
    text = "\n".join(page.extract_text() for page in reader.pages)
    (folder / f"{name}.txt").write_text(text, encoding="utf-8")
    assert all(character in text for character in "ăâîșț"), f"Missing Romanian glyph: {name}"
    assert "\ufffd" not in text and "\u25a0" not in text, f"Broken glyph: {name}"
    assert "FORMA" in reader.metadata.title or "Deviz" in reader.metadata.title or "Fișă" in reader.metadata.title
    for index, page in enumerate(document):
        page.get_pixmap(matrix=pymupdf.Matrix(1.3, 1.3)).save(folder / f"{name}-{index+1}.png")
        page_text = page.get_text()
        assert f"Pagina {index+1} din {len(document)}" in page_text
        assert len(page_text.strip()) > 100, f"Unexpected blank page: {name}/{index+1}"
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    x0, y0, x1, y1 = span["bbox"]
                    assert x0 >= 10 and y0 >= 5 and x1 <= page.rect.width - 10 and y1 <= page.rect.height - 5, (name, index+1, span["text"], span["bbox"])
    if name.startswith("quotation"):
        assert "951,54 RON" in text
        for forbidden in ["Cost de producție", "Adaos comercial", "Manoperă fixă", "Preț unitar", "Feronerie"]:
            assert forbidden not in text, f"Internal information: {forbidden}"
        assert "Preț estimativ fără TVA" in text
    else:
        assert "RON" not in text
        assert "ABS 2 mm" in text and "Feronerie" in text and "2000 mm" in text
        assert len(document[0].get_drawings()) > 20, "Expected vector technical drawing"
    if name == "workshop-pagination-test":
        overview = pymupdf.open()
        sheet = overview.new_page(width=4*210, height=4*297)
        for index in range(len(document)):
            x, y = index % 4 * 210, index // 4 * 297
            sheet.show_pdf_page(pymupdf.Rect(x, y, x+210, y+297), document, index)
        sheet.get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(folder / "pagination-overview.png")
    report.append({"file":source.name,"pages":len(document),"characters":len(text),"vector_objects_first_page":len(document[0].get_drawings())})
(folder / "inspection.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=True, indent=2))
