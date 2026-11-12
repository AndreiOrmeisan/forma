from decimal import Decimal, localcontext

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from forma.domains.furniture.panel_calculation import calculate_wardrobe
from forma.domains.furniture.schemas import ConfirmedWardrobeConfiguration, WardrobeConfiguration
from forma.domains.furniture.wardrobe_geometry import calculate_panel_geometry
from forma.main import create_app

EXAMPLE = {"width_mm": 800, "height_mm": 2000, "depth_mm": 600, "doors_count": 2, "shelves_count": 3, "furniture_type": "wardrobe"}
ENDPOINT = "/api/v1/furniture/calculate"


def request(**changes) -> ConfirmedWardrobeConfiguration:
    return ConfirmedWardrobeConfiguration(configuration=WardrobeConfiguration(**(EXAMPLE | changes)), confirmed=True)


def test_standard_cutting_list_and_net_areas():
    result = calculate_wardrobe(request())
    panels = {panel.id: panel for panel in result.panels}
    expected = {
        "sides": ("PAL", "18", "2000", "600", 2),
        "top": ("PAL", "18", "764", "600", 1),
        "bottom": ("PAL", "18", "764", "600", 1),
        "shelves": ("PAL", "18", "764", "550", 3),
        "doors": ("PAL", "18", "1996", "397", 2),
        "back": ("HDF", "3", "800", "2000", 1),
    }
    assert set(panels) == set(expected)
    for identifier, (material, thickness, length, width, quantity) in expected.items():
        panel = panels[identifier]
        assert (panel.material, panel.thickness_mm, panel.length_mm, panel.width_mm, panel.quantity) == (
            material, Decimal(thickness), Decimal(length), Decimal(width), quantity,
        )
        assert panel.unit_area_m2 == Decimal(length) * Decimal(width) / 1_000_000
        assert panel.area_m2 == panel.unit_area_m2 * quantity
        assert panel.orientation == "unspecified"
    assert result.totals.total_pal_area_m2 == Decimal("6.162224")
    assert result.totals.total_hdf_area_m2 == Decimal("1.6")
    assert result.totals.total_panel_count == 10
    assert result.construction_profile.interior_bays_count == 1


@pytest.mark.parametrize("doors_count,door_width,panel_count", [(1, "796", 9), (2, "397", 10)])
def test_door_rules_and_no_divider(doors_count, door_width, panel_count):
    result = calculate_wardrobe(request(doors_count=doors_count))
    doors = next(panel for panel in result.panels if panel.id == "doors")
    assert doors.width_mm == Decimal(door_width)
    assert doors.length_mm == Decimal("1996")
    assert doors.quantity == doors_count
    assert result.totals.total_panel_count == panel_count
    assert not any("divider" in panel.id for panel in result.panels)


@pytest.mark.parametrize("shelves_count,panel_count", [(0, 7), (10, 17)])
def test_shelf_limits_and_zero_rows(shelves_count, panel_count):
    result = calculate_wardrobe(request(shelves_count=shelves_count))
    shelves = [panel for panel in result.panels if panel.id == "shelves"]
    assert len(shelves) == bool(shelves_count)
    if shelves_count:
        assert shelves[0].quantity == shelves_count
    assert all(panel.quantity > 0 for panel in result.panels)
    assert result.totals.total_panel_count == panel_count


@pytest.mark.parametrize("width,height,depth", [(300, 400, 200), (2400, 3000, 1000)])
def test_narrow_and_wide_boundaries(width, height, depth):
    result = calculate_wardrobe(request(width_mm=width, height_mm=height, depth_mm=depth))
    for panel in result.panels:
        assert panel.length_mm > 0
        assert panel.width_mm > 0
    assert result.input_configuration.width_mm == width


@pytest.mark.parametrize("field,value", [
    ("width_mm", 299), ("width_mm", 2401), ("width_mm", 0),
    ("height_mm", 399), ("height_mm", 3001), ("height_mm", -1),
    ("depth_mm", 199), ("depth_mm", 1001),
    ("doors_count", 0), ("doors_count", 3), ("doors_count", True),
    ("shelves_count", -1), ("shelves_count", 11),
    ("width_mm", "800"), ("width_mm", 800.5),
])
def test_central_configuration_validation(field, value):
    with pytest.raises(ValidationError):
        request(**{field: value})


@pytest.mark.parametrize("changes", [{"width_mm": 36}, {"width_mm": 35}, {"depth_mm": 50}, {"height_mm": 4}])
def test_non_positive_calculated_dimensions_are_rejected(changes):
    # Bypass boundary validation to exercise the geometry's own positivity guard.
    invalid = WardrobeConfiguration.model_construct(**(EXAMPLE | changes))
    with pytest.raises(ValidationError):
        calculate_panel_geometry(invalid)


def test_hdf_is_excluded_from_pal_total():
    result = calculate_wardrobe(request())
    pal = sum((panel.area_m2 for panel in result.panels if panel.material == "PAL"), Decimal(0))
    hdf = sum((panel.area_m2 for panel in result.panels if panel.material == "HDF"), Decimal(0))
    assert result.totals.total_pal_area_m2 == pal
    assert result.totals.total_hdf_area_m2 == hdf
    assert pal != pal + hdf


def test_fractional_door_width_and_serialization_are_exact():
    result = calculate_wardrobe(request(width_mm=801))
    door = next(panel for panel in result.panels if panel.id == "doors")
    assert door.width_mm == Decimal("397.5")
    assert door.unit_area_m2 == Decimal("0.79341")
    assert door.area_m2 == Decimal("1.58682")
    encoded = result.model_dump(mode="json")
    assert next(panel for panel in encoded["panels"] if panel["id"] == "doors")["width_mm"] == "397.5"
    assert isinstance(encoded["totals"]["total_pal_area_m2"], str)


def test_repeated_results_and_decimal_context_independence():
    first = calculate_wardrobe(request(width_mm=801)).model_dump_json()
    assert calculate_wardrobe(request(width_mm=801)).model_dump_json() == first
    with localcontext() as context:
        context.prec = 6
        context.Emax = 2
        assert calculate_wardrobe(request(width_mm=801)).model_dump_json() == first


def test_endpoint_accepts_explicit_confirmation_without_an_image():
    with TestClient(create_app()) as client:
        response = client.post(ENDPOINT, json={"configuration": EXAMPLE, "confirmed": True})
    assert response.status_code == 200
    assert response.json()["totals"]["total_pal_area_m2"] == "6.162224"


@pytest.mark.parametrize("body", [
    {"configuration": EXAMPLE},
    {"configuration": EXAMPLE, "confirmed": False},
    {"configuration": EXAMPLE, "confirmed": "true"},
    {"configuration": EXAMPLE, "confirmed": 1},
    {"configuration": EXAMPLE | {"is_mock": True, "requires_confirmation": True}, "confirmed": True},
    {"configuration": EXAMPLE | {"width_mm": 0}, "confirmed": True},
    {"configuration": EXAMPLE | {"furniture_type": "kitchen"}, "confirmed": True},
    {"configuration": {key: value for key, value in EXAMPLE.items() if key != "height_mm"}, "confirmed": True},
    {"configuration": EXAMPLE, "confirmed": True, "construction_profile": {"pal_thickness_mm": 16}},
    EXAMPLE | {"is_mock": True, "requires_confirmation": True},
])
def test_endpoint_rejects_unconfirmed_or_invalid_input(body):
    with TestClient(create_app()) as client:
        response = client.post(ENDPOINT, json=body)
    assert response.status_code == 422
