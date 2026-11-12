"""FORMA POC v1 panel dimensions, independent of images and interpretation."""

from decimal import Decimal

from forma.domains.furniture.schemas import ConstructionProfile, PanelGeometry, WardrobeConfiguration

PROFILE = ConstructionProfile(
    id="forma-wardrobe-poc-v1",
    name="FORMA POC v1",
    pal_thickness_mm=Decimal("18"),
    hdf_thickness_mm=Decimal("3"),
    shelf_setback_mm=Decimal("50"),
    door_outer_gap_mm=Decimal("2"),
    door_middle_gap_mm=Decimal("2"),
    door_top_gap_mm=Decimal("2"),
    door_bottom_gap_mm=Decimal("2"),
    assumptions=(
        "Dulap dreptunghiular, de sine stătător, cu laterale pe toată înălțimea.",
        "PAL de 18 mm. Capacul și baza sunt montate între laterale.",
        "Un singur compartiment interior continuu, inclusiv pentru două uși.",
        "Polițe între laterale, cu adâncimea redusă cu 50 mm.",
        "Una sau două uși batante aplicate, cu joc exterior de 2 mm pe fiecare laterală.",
        "Joc de 2 mm între două uși și de 2 mm sus și jos.",
        "Spate HDF de 3 mm, aplicat pe partea din spate a corpului.",
        "Orientarea fibrei sau a decorului este nespecificată.",
    ),
)


def calculate_panel_geometry(configuration: WardrobeConfiguration) -> tuple[PanelGeometry, ...]:
    width = Decimal(configuration.width_mm)
    height = Decimal(configuration.height_mm)
    depth = Decimal(configuration.depth_mm)
    inner_width = width - 2 * PROFILE.pal_thickness_mm
    door_height = height - PROFILE.door_top_gap_mm - PROFILE.door_bottom_gap_mm
    door_width = width - 2 * PROFILE.door_outer_gap_mm
    if configuration.doors_count == 2:
        door_width = (door_width - PROFILE.door_middle_gap_mm) / 2

    panels = [
        PanelGeometry(id="sides", name="Laterale", material="PAL", thickness_mm=PROFILE.pal_thickness_mm,
                      length_mm=height, width_mm=depth, quantity=2),
        PanelGeometry(id="top", name="Capac", material="PAL", thickness_mm=PROFILE.pal_thickness_mm,
                      length_mm=inner_width, width_mm=depth, quantity=1),
        PanelGeometry(id="bottom", name="Bază", material="PAL", thickness_mm=PROFILE.pal_thickness_mm,
                      length_mm=inner_width, width_mm=depth, quantity=1),
    ]
    if configuration.shelves_count:
        panels.append(PanelGeometry(
            id="shelves", name="Polițe", material="PAL", thickness_mm=PROFILE.pal_thickness_mm,
            length_mm=inner_width, width_mm=depth - PROFILE.shelf_setback_mm,
            quantity=configuration.shelves_count,
        ))
    panels.extend([
        PanelGeometry(id="doors", name="Uși", material="PAL", thickness_mm=PROFILE.pal_thickness_mm,
                      length_mm=door_height, width_mm=door_width, quantity=configuration.doors_count),
        PanelGeometry(id="back", name="Spate", material="HDF", thickness_mm=PROFILE.hdf_thickness_mm,
                      length_mm=width, width_mm=height, quantity=1),
    ])
    return tuple(panels)
