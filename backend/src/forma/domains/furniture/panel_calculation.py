"""Exact, reproducible cutting lists and net material areas."""

from decimal import Context, Decimal, localcontext

from forma.domains.furniture.schemas import (
    CalculationTotals,
    ConfirmedWardrobeConfiguration,
    Panel,
    WardrobeCalculationResult,
)
from forma.domains.furniture.wardrobe_geometry import PROFILE, calculate_panel_geometry


def calculate_wardrobe(request: ConfirmedWardrobeConfiguration) -> WardrobeCalculationResult:
    # Isolate arithmetic from a caller's Decimal precision or rounding settings.
    with localcontext(Context(prec=28)):
        panels = []
        for geometry in calculate_panel_geometry(request.configuration):
            unit_area = geometry.length_mm * geometry.width_mm / Decimal("1000000")
            panels.append(Panel(
                **geometry.model_dump(),
                unit_area_m2=unit_area,
                area_m2=unit_area * geometry.quantity,
            ))

        return WardrobeCalculationResult(
            construction_profile=PROFILE,
            input_configuration=request.configuration,
            panels=tuple(panels),
            totals=CalculationTotals(
                total_pal_area_m2=sum((panel.area_m2 for panel in panels if panel.material == "PAL"), Decimal(0)),
                total_hdf_area_m2=sum((panel.area_m2 for panel in panels if panel.material == "HDF"), Decimal(0)),
                total_panel_count=sum(panel.quantity for panel in panels),
            ),
            warnings=("Suprafețele sunt nete și se referă la piesele din listă, înainte de optimizarea pe foi.",),
        )
