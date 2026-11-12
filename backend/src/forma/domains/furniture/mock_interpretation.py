"""Deterministic demonstration data, independent of image content."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, NonNegativeInt, PositiveInt


class MockSketchInterpretation(BaseModel):
    model_config = ConfigDict(frozen=True)

    width_mm: PositiveInt
    height_mm: PositiveInt
    depth_mm: PositiveInt
    doors_count: PositiveInt
    shelves_count: NonNegativeInt
    furniture_type: Literal["wardrobe"] = "wardrobe"
    is_mock: Literal[True] = True
    requires_confirmation: Literal[True] = True
    notice: str = (
        "Date demonstrative, independente de conținutul fotografiei. "
        "Verifică și confirmă dimensiunile și configurația dulapului."
    )


def mock_sketch_interpretation() -> MockSketchInterpretation:
    return MockSketchInterpretation(
        width_mm=800,
        height_mm=2000,
        depth_mm=600,
        doors_count=2,
        shelves_count=3,
    )
