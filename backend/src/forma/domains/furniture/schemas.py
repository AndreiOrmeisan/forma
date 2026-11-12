"""Validated wardrobe input and exact panel calculation contracts."""

from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WardrobeConfiguration(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    width_mm: Annotated[int, Field(strict=True, ge=300, le=2400)]
    height_mm: Annotated[int, Field(strict=True, ge=400, le=3000)]
    depth_mm: Annotated[int, Field(strict=True, ge=200, le=1000)]
    doors_count: Annotated[int, Field(strict=True, ge=1, le=2)]
    shelves_count: Annotated[int, Field(strict=True, ge=0, le=10)]
    furniture_type: Literal["wardrobe"] = "wardrobe"


class ConfirmedWardrobeConfiguration(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    configuration: WardrobeConfiguration
    confirmed: Literal[True]

    @field_validator("confirmed", mode="before")
    @classmethod
    def require_explicit_confirmation(cls, value: object) -> bool:
        if value is not True:
            raise ValueError("Configurația trebuie confirmată explicit înainte de calcul.")
        return True


class ConstructionProfile(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    pal_thickness_mm: Decimal
    hdf_thickness_mm: Decimal
    shelf_setback_mm: Decimal
    door_outer_gap_mm: Decimal
    door_middle_gap_mm: Decimal
    door_top_gap_mm: Decimal
    door_bottom_gap_mm: Decimal
    interior_bays_count: Literal[1] = 1
    assumptions: tuple[str, ...]


class PanelGeometry(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str
    name: str
    material: Literal["PAL", "HDF"]
    thickness_mm: Annotated[Decimal, Field(gt=0, allow_inf_nan=False)]
    length_mm: Annotated[Decimal, Field(gt=0, allow_inf_nan=False)]
    width_mm: Annotated[Decimal, Field(gt=0, allow_inf_nan=False)]
    quantity: Annotated[int, Field(strict=True, gt=0)]
    orientation: Literal["unspecified"] = "unspecified"


class Panel(PanelGeometry):
    unit_area_m2: Annotated[Decimal, Field(gt=0, allow_inf_nan=False)]
    area_m2: Annotated[Decimal, Field(gt=0, allow_inf_nan=False)] = Field(
        description="Net area of this panel row, including quantity."
    )


class CalculationTotals(BaseModel):
    model_config = ConfigDict(frozen=True)

    total_pal_area_m2: Decimal
    total_hdf_area_m2: Decimal
    total_panel_count: int


class WardrobeCalculationResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    construction_profile: ConstructionProfile
    input_configuration: WardrobeConfiguration
    panels: tuple[Panel, ...]
    totals: CalculationTotals
    warnings: tuple[str, ...]
