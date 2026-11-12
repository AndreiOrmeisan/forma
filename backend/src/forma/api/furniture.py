"""Furniture HTTP adapters."""

from fastapi import APIRouter, UploadFile

from forma.domains.furniture.mock_interpretation import (
    MockSketchInterpretation,
    mock_sketch_interpretation,
)
from forma.shared.images import validate_uploaded_image

router = APIRouter(prefix="/v1/furniture", tags=["furniture"])


@router.post("/analyze-sketch", response_model=MockSketchInterpretation)
def analyze_sketch(file: UploadFile) -> MockSketchInterpretation:
    """Validate a file and return fixed demonstration values."""
    validate_uploaded_image(file)
    return mock_sketch_interpretation()
