"""Render synthetic workshop documents for manual visual QA (developer only)."""

from pathlib import Path

import fitz

root = Path(__file__).resolve().parents[2]
output = root / "output/pdf"
for name in ("complete", "incomplete"):
    document = fitz.open(output / f"manufacturing-{name}.pdf")
    for index, page in enumerate(document):
        page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3)).save(output / f"manufacturing-{name}-{index + 1}.png")
    text = "\n".join(page.get_text() for page in document)
    assert "Dimensiuni brute neconfirmate" in text
    assert "Fișă tehnică de verificare" in text
    assert "cost de producție" not in text.lower()
    assert "Adaos comercial" not in text
    assert "Adâncime totală" in text
    (output / f"manufacturing-{name}.txt").write_text(text, encoding="utf-8")
    print(f"{name}: {len(document)} pages rendered, manufacturing/privacy labels found.")
