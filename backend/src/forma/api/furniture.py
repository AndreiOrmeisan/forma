"""Furniture HTTP adapters."""

from fastapi import APIRouter, UploadFile

from forma.domains.furniture.mock_interpretation import (
    MockSketchInterpretation,
    mock_sketch_interpretation,
)
from forma.shared.images import validate_uploaded_image
from forma.domains.furniture.panel_calculation import calculate_wardrobe
from forma.domains.furniture.schemas import ConfirmedWardrobeConfiguration, WardrobeCalculationResult
from forma.domains.furniture.pricing import EstimateRequest, EstimateResult, estimate_wardrobe

router = APIRouter(prefix="/v1/furniture", tags=["furniture"])

@router.post("/estimate", response_model=EstimateResult)
def estimate(request: EstimateRequest) -> EstimateResult:
    """Recalculate confirmed quantities and apply manually supplied prices."""
    return estimate_wardrobe(request)


@router.post("/analyze-sketch", response_model=MockSketchInterpretation)
def analyze_sketch(file: UploadFile) -> MockSketchInterpretation:
    """Validate a file and return fixed demonstration values."""
    validate_uploaded_image(file)
    return mock_sketch_interpretation()


@router.post("/calculate", response_model=WardrobeCalculationResult)
def calculate(request: ConfirmedWardrobeConfiguration) -> WardrobeCalculationResult:
    """Calculate panels from an explicitly confirmed configuration."""
    return calculate_wardrobe(request)
