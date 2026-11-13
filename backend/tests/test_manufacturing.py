"""Synthetic dimensional examples are not physical manufacturing approval."""

import json
from copy import deepcopy
from decimal import Decimal, localcontext
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from forma.main import app
from forma.domains.furniture.manufacturing import (
    ManufacturingProfile, ManufacturingRequest, ManufacturingSnapshot, NetRule, LayerRule,
    calculate_manufacturing, contribution, missing_settings, panel_dimensions,
)
from forma.domains.furniture.panel_calculation import calculate_wardrobe
from forma.domains.furniture.schemas import ConfirmedWardrobeConfiguration, Panel, PanelEdges
from forma.domains.furniture.projects import ProjectInput, ProjectPatch

ROOT = Path(__file__).resolve().parents[2]
PROFILE = json.loads((ROOT / "frontend/tests/fixtures/manufacturing-profile.json").read_text(encoding="utf-8"))
CONFIG = {"width_mm": 800, "height_mm": 2000, "depth_mm": 600, "doors_count": 2, "shelves_count": 3, "furniture_type": "wardrobe"}


def snapshot(profile=None):
    p = deepcopy(profile or PROFILE)
    return {"schema_version": 1, "dimensional_profile_id": "forma-wardrobe-manufacturing-v1", "calculation_version": "manufacturing-dimensions-v1",
            "geometry_basis": "forma-wardrobe-poc-v1", "selected_at": "2026-11-13T12:01:00Z", "approval_status": p["status"],
            "supplier_name_at_selection": None, "supplier_status_at_selection": "standalone", "profile": p}


def calculate(profile=None, configuration=None):
    return calculate_manufacturing(ManufacturingRequest(configuration=configuration or CONFIG, confirmed=True, snapshot=snapshot(profile)))


def panel(edges=None, length="100.5", width="50.5"):
    return Panel(id="synthetic", name="Piesă sintetică", material="PAL", thickness_mm="18", length_mm=length, width_mm=width, quantity=1,
                 edges=edges or PanelEdges(), unit_area_m2="0.00507525", area_m2="0.00507525")


def test_legacy_reference_is_unchanged_and_manufacturing_is_separate():
    before = calculate_wardrobe(ConfirmedWardrobeConfiguration(configuration=CONFIG, confirmed=True))
    result = calculate()
    after = calculate_wardrobe(ConfirmedWardrobeConfiguration(configuration=CONFIG, confirmed=True))
    assert before == after
    assert before.construction_profile.id == "forma-wardrobe-poc-v1"
    assert before.totals.total_pal_area_m2 == Decimal("6.162224")
    assert before.totals.total_hdf_area_m2 == Decimal("1.600000")
    assert before.edge_banding.totals_by_type.abs_2_total_m == Decimal("17.392")
    assert [item.quantity for item in before.hardware.items] == [8, 12, 2, 8, 40]
    assert result.dimensional_profile_id != before.construction_profile.id
    door = next(p for p in result.panels if p.panel_id == "doors")
    assert (door.finished_length_mm, door.finished_width_mm) == (Decimal("1996"), Decimal("397"))
    assert (door.raw_length_mm, door.raw_width_mm) == (Decimal("1992"), Decimal("393"))
    expected = json.loads((ROOT / "frontend/tests/fixtures/manufacturing-result.json").read_text(encoding="utf-8"))
    assert result.model_dump(mode="json") == expected


@pytest.mark.parametrize("edges,expected_length,expected_width", [
    (PanelEdges(), "100.5", "50.5"),
    (PanelEdges(length_start="abs_2"), "98.5", "50.5"),
    (PanelEdges(length_start="abs_2", length_end="abs_2"), "96.5", "50.5"),
    (PanelEdges(length_start="abs_2", length_end="abs_2", width_start="abs_2", width_end="abs_2"), "96.5", "46.5"),
    (PanelEdges(length_start="abs_0_4", width_end="abs_2"), "100.1", "48.5"),
])
def test_each_edge_contributes_only_to_its_axis(edges, expected_length, expected_width):
    result = panel_dimensions(panel(edges), ManufacturingProfile.model_validate(PROFILE))
    assert result.raw_length_mm == Decimal(expected_length)
    assert result.raw_width_mm == Decimal(expected_width)


def test_explicit_zero_and_missing_premilling_are_distinct():
    zero = LayerRule(mode="layers", applied_thickness_mm="2", removal_mm="0")
    missing = LayerRule(mode="layers", applied_thickness_mm="2", removal_mm=None)
    assert contribution(zero) == Decimal("2")
    assert contribution(missing) is None
    profile = deepcopy(PROFILE)
    profile["edge_processing_rules"]["abs_2"] = missing.model_dump(mode="json")
    result = calculate(profile)
    assert result.readiness == "configuration_incomplete"
    assert next(p for p in result.panels if p.panel_id == "doors").raw_width_mm is None


def test_direct_and_layer_rules_are_equivalent_without_double_subtraction():
    net = NetRule(mode="net", net_contribution_mm="1")
    layers = LayerRule(mode="layers", applied_thickness_mm="2", removal_mm="1")
    assert contribution(net) == contribution(layers) == Decimal("1")
    profile = deepcopy(PROFILE)
    profile["edge_processing_rules"]["abs_2"] = layers.model_dump(mode="json")
    door = next(p for p in calculate(profile).panels if p.panel_id == "doors")
    assert door.raw_width_mm == Decimal("395")
    with pytest.raises(ValidationError):
        NetRule.model_validate({"mode": "net", "net_contribution_mm": "1", "removal_mm": "1"})


def test_fractional_raw_dimensions_are_exact_and_caller_context_does_not_change_results():
    profile = deepcopy(PROFILE)
    profile["edge_processing_rules"]["abs_2"] = {"mode": "net", "net_contribution_mm": "0.125"}
    profile["cutting_precision_mm"] = "0.001"
    config = CONFIG | {"width_mm": 801}
    result = calculate(profile, config)
    with localcontext() as context:
        context.prec = 4
        assert calculate(profile, config) == result
    assert next(p for p in result.panels if p.panel_id == "doors").raw_width_mm == Decimal("397.25")


@pytest.mark.parametrize("field", ["cutting_precision_mm", "rounding_policy", "dimensional_tolerance_mm", "front_projection_mm", "back_projection_mm"])
def test_missing_required_settings_never_become_approval(field):
    profile = deepcopy(PROFILE)
    profile[field] = None
    result = calculate(profile)
    assert result.readiness == "configuration_incomplete"
    if field in ("cutting_precision_mm", "rounding_policy"):
        assert all(p.cutting_width_mm is None for p in result.panels)
    if field.endswith("projection_mm"):
        assert result.overall_depth_mm is None


@pytest.mark.parametrize("policy,expected", [("half_up", "47"), ("ceil", "47"), ("floor", "46"), ("exact", None)])
def test_explicit_rounding_policy_and_tolerance(policy, expected):
    profile = ManufacturingProfile.model_validate(PROFILE | {"cutting_precision_mm": "1", "rounding_policy": policy, "dimensional_tolerance_mm": "1"})
    result = panel_dimensions(panel(PanelEdges(width_start="abs_2", width_end="abs_2")), profile)
    assert result.raw_width_mm == Decimal("46.5")
    assert result.cutting_width_mm == (None if expected is None else Decimal(expected))
    strict = profile.model_copy(update={"dimensional_tolerance_mm": Decimal("0")})
    assert panel_dimensions(panel(), strict).cutting_width_mm is None


def test_invalid_raw_and_unsupported_edges_are_unresolved_not_negative_output():
    profile = ManufacturingProfile.model_validate(PROFILE)
    result = panel_dimensions(panel(PanelEdges(width_start="abs_2", width_end="abs_2"), width="3"), profile)
    assert result.raw_width_mm is None
    assert result.cutting_width_mm is None
    unsupported = ManufacturingProfile.model_validate(PROFILE | {"supported_edge_types": [], "edge_processing_rules": {}})
    assert panel_dimensions(panel(PanelEdges(width_start="abs_2")), unsupported).raw_width_mm is None


@pytest.mark.parametrize("change", [{"cutting_precision_mm": "0"}, {"cutting_precision_mm": 0.1}, {"back_projection_mm": "-1"},
                                    {"front_projection_mm": "1001"}, {"dimensional_tolerance_mm": "NaN"}, {"rounding_policy": "automatic"},
                                    {"cutting_precision_mm": "1e-2"}])
def test_invalid_parameters_rejected(change):
    with pytest.raises(ValidationError):
        ManufacturingProfile.model_validate(PROFILE | change)


def test_validation_is_explicit_but_never_physical_approval():
    draft = ManufacturingProfile.model_validate(PROFILE)
    assert not missing_settings(draft)
    assert draft.status == "draft"
    assert calculate().readiness == "calculation_ready_unverified"
    assert calculate(PROFILE | {"status": "validated"}).readiness == "calculation_ready_unverified"
    assert calculate(PROFILE | {"status": "archived"}).readiness == "configuration_incomplete"
    with pytest.raises(ValidationError):
        ManufacturingProfile.model_validate(PROFILE | {"status": "validated", "back_projection_mm": None})


def test_depth_convention_adds_only_explicit_projections_once():
    assert calculate().carcass_depth_mm == Decimal("600")
    assert calculate().overall_depth_mm == Decimal("621")
    assert calculate(PROFILE | {"back_projection_mm": "0", "front_projection_mm": "0"}).overall_depth_mm == Decimal("600")
    assert calculate(PROFILE | {"front_projection_mm": None}).overall_depth_mm is None


def test_http_uses_confirmed_inputs_and_returns_decimal_strings():
    client = TestClient(app)
    request = {"configuration": CONFIG, "confirmed": True, "snapshot": snapshot()}
    result = client.post("/api/v1/furniture/manufacturing-dimensions", json=request)
    assert result.status_code == 200
    assert result.json()["overall_depth_mm"] == "621"
    assert result.json()["readiness"] != "workshop_approved"
    assert client.post("/api/v1/furniture/manufacturing-dimensions", json=request | {"confirmed": False}).status_code == 422
    bad = deepcopy(request)
    bad["snapshot"]["approval_status"] = "validated"
    assert client.post("/api/v1/furniture/manufacturing-dimensions", json=bad).status_code == 422


def test_snapshot_project_dtos_are_additive_and_keep_legacy_prices():
    saved = json.loads((ROOT / "frontend/tests/fixtures/wardrobe-project.json").read_text(encoding="utf-8"))
    for key in ("id", "created_at", "updated_at", "revision", "compatible", "deviz_complete", "warnings"):
        saved.pop(key)
    legacy = ProjectInput.model_validate(saved)
    applied = ProjectInput.model_validate(saved | {"manufacturing_snapshot": snapshot()})
    assert legacy.manufacturing_snapshot is None
    assert applied.manufacturing_snapshot.profile.id == ManufacturingProfile.model_validate(PROFILE).id
    assert applied.estimate_request() == legacy.estimate_request()
    assert ProjectPatch(expected_revision=1, manufacturing_snapshot=None).model_fields_set == {"expected_revision", "manufacturing_snapshot"}
    detached = ManufacturingSnapshot.model_validate(snapshot())
    changed = deepcopy(PROFILE)
    changed["edge_processing_rules"]["abs_2"]["net_contribution_mm"] = "1"
    assert detached.profile.edge_processing_rules["abs_2"].net_contribution_mm == Decimal("2")
