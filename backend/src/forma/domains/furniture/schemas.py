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


EdgeBandingType = Literal["none", "abs_0_4", "abs_2"]
EdgeName = Literal["length_start", "length_end", "width_start", "width_end"]
NonNegativeDecimal = Annotated[Decimal, Field(ge=0, allow_inf_nan=False)]


class PanelEdges(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    length_start: EdgeBandingType = "none"
    length_end: EdgeBandingType = "none"
    width_start: EdgeBandingType = "none"
    width_end: EdgeBandingType = "none"


class Panel(PanelGeometry):
    unit_area_m2: Annotated[Decimal, Field(gt=0, allow_inf_nan=False)]
    area_m2: Annotated[Decimal, Field(gt=0, allow_inf_nan=False)] = Field(
        description="Net area of this panel row, including quantity."
    )
    edges: PanelEdges | None = None


class EdgeDetail(BaseModel):
    model_config = ConfigDict(frozen=True)

    edge: EdgeName
    name: str
    banding_type: EdgeBandingType
    length_mm: Annotated[Decimal, Field(gt=0, allow_inf_nan=False)]
    net_length_per_piece_m: NonNegativeDecimal
    total_net_length_m: NonNegativeDecimal


class PanelEdgeDetails(BaseModel):
    model_config = ConfigDict(frozen=True)

    panel_id: str
    name: str
    quantity: Annotated[int, Field(strict=True, gt=0)]
    edges: tuple[EdgeDetail, EdgeDetail, EdgeDetail, EdgeDetail]
    net_length_per_piece_m: NonNegativeDecimal
    total_net_length_m: NonNegativeDecimal


class EdgeBandingTotals(BaseModel):
    model_config = ConfigDict(frozen=True)

    abs_0_4_total_m: NonNegativeDecimal
    abs_2_total_m: NonNegativeDecimal


class EdgeBandingResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    panel_edges: tuple[PanelEdgeDetails, ...]
    totals_by_type: EdgeBandingTotals
    total_net_length_m: NonNegativeDecimal
    procurement_allowance_m: NonNegativeDecimal = Decimal("0")
    edge_convention: str
    assumptions: tuple[str, ...]


class HardwareItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: Literal["hinges", "shelf_supports", "handles", "cabinet_connectors", "hdf_fasteners"]
    name: str
    quantity: Annotated[int, Field(strict=True, ge=0)]
    unit: Literal["buc."] = "buc."
    calculation_rule: str
    is_estimate: bool


class HardwareResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: tuple[HardwareItem, ...]
    total_item_count: Annotated[int, Field(strict=True, ge=0)]
    assumptions: tuple[str, ...]


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
    edge_banding: EdgeBandingResult
    hardware: HardwareResult
