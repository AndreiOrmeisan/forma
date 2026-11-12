"""Hardware quantities derived from the same panels as the cutting list."""

from forma.domains.furniture.hardware_rules import (
    CONNECTORS_PER_HORIZONTAL_PANEL,
    HARDWARE_ASSUMPTIONS,
    HDF_MAX_SPACING_MM,
    SUPPORTS_PER_SHELF,
    hinges_per_door,
    perimeter_fastener_count,
)
from forma.domains.furniture.schemas import HardwareItem, HardwareResult, Panel


def calculate_hardware(panels: tuple[Panel, ...]) -> HardwareResult:
    by_id = {panel.id: panel for panel in panels}
    if len(by_id) != len(panels) or not {"sides", "top", "bottom", "doors", "back"} <= by_id.keys():
        raise ValueError("Hardware estimation requires a complete, unique FORMA v1 panel set.")
    doors = by_id["doors"]
    back = by_id["back"]
    shelves = by_id.get("shelves")
    shelf_quantity = shelves.quantity if shelves else 0
    hinge_quantity = hinges_per_door(doors.length_mm)
    connector_quantity = CONNECTORS_PER_HORIZONTAL_PANEL * (by_id["top"].quantity + by_id["bottom"].quantity)
    fastener_quantity = perimeter_fastener_count(back.length_mm, back.width_mm) * back.quantity

    items = (
        HardwareItem(
            id="hinges", name="Balamale", quantity=hinge_quantity * doors.quantity, is_estimate=True,
            calculation_rule=f"{hinge_quantity} balamale/ușă pentru înălțimea de {doors.length_mm} mm × {doors.quantity} uși.",
        ),
        HardwareItem(
            id="shelf_supports", name="Suporturi pentru polițe", quantity=SUPPORTS_PER_SHELF * shelf_quantity, is_estimate=False,
            calculation_rule=f"{shelf_quantity} polițe reglabile × {SUPPORTS_PER_SHELF} suporturi.",
        ),
        HardwareItem(
            id="handles", name="Mânere", quantity=doors.quantity, is_estimate=False,
            calculation_rule=f"{doors.quantity} uși × 1 mâner.",
        ),
        HardwareItem(
            id="cabinet_connectors", name="Conectori pentru corp", quantity=connector_quantity, is_estimate=False,
            calculation_rule="4 conectori pentru capac și 4 pentru bază. Polițele reglabile folosesc suporturi.",
        ),
        HardwareItem(
            id="hdf_fasteners", name="Fixări pentru spatele HDF", quantity=fastener_quantity, is_estimate=True,
            calculation_rule=(
                f"2 × (ceil({back.length_mm} / {HDF_MAX_SPACING_MM}) + ceil({back.width_mm} / {HDF_MAX_SPACING_MM})) "
                f"× {back.quantity} spate HDF = {fastener_quantity} fixări. Colțurile sunt numărate o singură dată."
            ),
        ),
    )
    return HardwareResult(items=items, total_item_count=sum(item.quantity for item in items), assumptions=HARDWARE_ASSUMPTIONS)
