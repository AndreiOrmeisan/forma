from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from forma.domains.furniture.edge_banding import calculate_edge_banding
from forma.domains.furniture.edge_banding_rules import panel_edge_rules
from forma.domains.furniture.hardware import calculate_hardware
from forma.domains.furniture.hardware_rules import hinges_per_door, perimeter_fastener_count
from forma.domains.furniture.panel_calculation import calculate_wardrobe
from forma.domains.furniture.schemas import ConfirmedWardrobeConfiguration, PanelEdges, WardrobeConfiguration
from forma.main import create_app


def calculate(**changes):
    configuration = WardrobeConfiguration(**({
        "width_mm": 800, "height_mm": 2000, "depth_mm": 600,
        "doors_count": 2, "shelves_count": 3,
    } | changes))
    return calculate_wardrobe(ConfirmedWardrobeConfiguration(configuration=configuration, confirmed=True))


def test_standard_edges_derived_from_cutting_geometry():
    result = calculate()
    panels = {panel.id: panel for panel in result.panels}
    expected_mm = (
        panels["sides"].length_mm * panels["sides"].quantity
        + sum((panels[key].length_mm * panels[key].quantity for key in ("top", "bottom", "shelves")), Decimal(0))
        + 2 * (panels["doors"].length_mm + panels["doors"].width_mm) * panels["doors"].quantity
    )
    edges = result.edge_banding
    assert edges.totals_by_type.abs_2_total_m == expected_mm / 1000
    assert edges.totals_by_type.abs_2_total_m == Decimal("17.392")
    assert edges.totals_by_type.abs_0_4_total_m == 0
    assert edges.total_net_length_m == expected_mm / 1000
    assert edges.procurement_allowance_m == 0
    assert sum((panel.total_net_length_m for panel in edges.panel_edges), Decimal(0)) == edges.total_net_length_m
    assert result.totals.total_pal_area_m2 == Decimal("6.162224")
    assert result.totals.total_hdf_area_m2 == Decimal("1.6")


@pytest.mark.parametrize("identifier", ["sides", "top", "bottom", "shelves"])
def test_front_edges_and_physical_edge_lengths(identifier):
    result = calculate()
    panel = next(panel for panel in result.panels if panel.id == identifier)
    details = next(panel for panel in result.edge_banding.panel_edges if panel.panel_id == identifier)
    assert panel.edges == PanelEdges(width_start="abs_2")
    assert {edge.edge for edge in details.edges} == {"length_start", "length_end", "width_start", "width_end"}
    for edge in details.edges:
        assert edge.length_mm == (panel.width_mm if edge.edge.startswith("length_") else panel.length_mm)
        assert edge.banding_type == ("abs_2" if edge.edge == "width_start" else "none")
    assert details.net_length_per_piece_m == panel.length_mm / 1000
    assert details.total_net_length_m == details.net_length_per_piece_m * panel.quantity


@pytest.mark.parametrize("doors_count", [1, 2])
def test_door_perimeter_and_handle_hinge_counts(doors_count):
    result = calculate(doors_count=doors_count)
    door = next(panel for panel in result.panels if panel.id == "doors")
    detail = next(panel for panel in result.edge_banding.panel_edges if panel.panel_id == "doors")
    assert all(edge.banding_type == "abs_2" for edge in detail.edges)
    assert detail.net_length_per_piece_m == 2 * (door.length_mm + door.width_mm) / 1000
    assert detail.total_net_length_m == detail.net_length_per_piece_m * doors_count
    items = {item.id: item for item in result.hardware.items}
    assert items["handles"].quantity == doors_count
    assert items["hinges"].quantity == 4 * doors_count


def test_hdf_has_no_edge_banding():
    result = calculate()
    back = next(panel for panel in result.panels if panel.id == "back")
    assert back.edges is None
    assert all(panel.panel_id != "back" for panel in result.edge_banding.panel_edges)


@pytest.mark.parametrize("shelves_count", [0, 3, 10])
def test_shelf_supports_connectors_and_zero_shelves(shelves_count):
    result = calculate(shelves_count=shelves_count)
    items = {item.id: item for item in result.hardware.items}
    assert items["shelf_supports"].quantity == shelves_count * 4
    assert items["cabinet_connectors"].quantity == 8
    assert bool([panel for panel in result.edge_banding.panel_edges if panel.panel_id == "shelves"]) == bool(shelves_count)
    assert result.hardware.total_item_count == sum(item.quantity for item in items.values())


def test_standard_hardware_quantities_and_preliminary_labels():
    result = calculate()
    items = {item.id: item for item in result.hardware.items}
    assert {key: item.quantity for key, item in items.items()} == {
        "hinges": 8, "shelf_supports": 12, "handles": 2,
        "cabinet_connectors": 8, "hdf_fasteners": 40,
    }
    assert result.hardware.total_item_count == 70
    assert items["hinges"].is_estimate is True
    assert items["hdf_fasteners"].is_estimate is True
    assert all(item.calculation_rule and item.unit == "buc." for item in items.values())
    assert result.hardware.assumptions


@pytest.mark.parametrize("height,expected", [
    ("899.5", 2), ("900", 2), ("900.5", 3),
    ("1600", 3), ("1600.5", 4), ("2200", 4), ("2200.5", 5),
])
def test_hinge_height_thresholds(height, expected):
    assert hinges_per_door(Decimal(height)) == expected


@pytest.mark.parametrize("cabinet_height,hinges", [(904, 4), (905, 6), (1604, 6), (1605, 8), (2204, 8), (2205, 10)])
def test_hinges_use_actual_door_height_after_gaps(cabinet_height, hinges):
    result = calculate(height_mm=cabinet_height)
    assert next(item for item in result.hardware.items if item.id == "hinges").quantity == hinges


@pytest.mark.parametrize("length,width,expected", [
    ("150", "150", 4), ("300", "450", 10), ("800", "2000", 40),
    ("750", "1500", 30), ("150.5", "150", 6), ("2400", "3000", 72),
])
def test_hdf_perimeter_spacing_and_unique_corners(length, width, expected):
    assert perimeter_fastener_count(Decimal(length), Decimal(width)) == expected


def test_hardware_uses_actual_hdf_geometry():
    original = calculate()
    panels = tuple(panel.model_copy(update={"length_mm": Decimal("750"), "width_mm": Decimal("1500")}) if panel.id == "back" else panel for panel in original.panels)
    hardware = calculate_hardware(panels)
    assert next(item for item in hardware.items if item.id == "hdf_fasteners").quantity == 30


def test_abs_point_four_is_supported_and_cutting_dimensions_are_preserved():
    original = calculate()
    panels = tuple(panel.model_copy(update={"edges": PanelEdges(width_start="abs_0_4")}) if panel.id == "top" else panel for panel in original.panels)
    snapshot = [panel.model_dump_json() for panel in panels]
    result = calculate_edge_banding(panels)
    top = next(panel for panel in panels if panel.id == "top")
    assert result.totals_by_type.abs_0_4_total_m == top.length_mm * top.quantity / 1000
    assert result.total_net_length_m == original.edge_banding.total_net_length_m
    assert [panel.model_dump_json() for panel in panels] == snapshot


def test_fractional_lengths_remain_exact_and_repeated_results_match():
    first = calculate(width_mm=801)
    assert first.edge_banding.total_net_length_m == Decimal("17.399")
    doors = next(panel for panel in first.edge_banding.panel_edges if panel.panel_id == "doors")
    assert next(edge for edge in doors.edges if edge.edge == "length_start").length_mm == Decimal("397.5")
    assert first.model_dump_json() == calculate(width_mm=801).model_dump_json()


def test_rules_are_based_on_identifiers_and_reject_unknown_pal():
    side = next(panel for panel in calculate().panels if panel.id == "sides")
    assert panel_edge_rules(side.model_copy(update={"name": "Unrelated label"})) == side.edges
    with pytest.raises(ValueError):
        panel_edge_rules(side.model_copy(update={"id": "unsupported"}))


def test_incomplete_or_inconsistent_metadata_fails_instead_of_returning_partial_totals():
    panels = calculate().panels
    missing_edges = tuple(panel.model_copy(update={"edges": None}) if panel.id == "sides" else panel for panel in panels)
    with pytest.raises(ValueError):
        calculate_edge_banding(missing_edges)
    banded_hdf = tuple(panel.model_copy(update={"edges": PanelEdges(width_start="abs_2")}) if panel.id == "back" else panel for panel in panels)
    with pytest.raises(ValueError):
        calculate_edge_banding(banded_hdf)
    with pytest.raises(ValueError):
        calculate_hardware(tuple(panel for panel in panels if panel.id != "back"))
    with pytest.raises(ValueError):
        calculate_hardware(panels + (panels[0],))


def test_engine_does_not_return_partial_response_on_estimation_failure(monkeypatch):
    def fail(_panels):
        raise ValueError("Estimation failed")
    monkeypatch.setattr("forma.domains.furniture.panel_calculation.calculate_hardware", fail)
    with TestClient(create_app(), raise_server_exceptions=False) as client:
        response = client.post("/api/v1/furniture/calculate", json={
            "configuration": {"width_mm": 800, "height_mm": 2000, "depth_mm": 600, "doors_count": 2, "shelves_count": 3},
            "confirmed": True,
        })
    assert response.status_code == 500
    assert "total_pal_area_m2" not in response.text
