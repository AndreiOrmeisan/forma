from decimal import Decimal
from io import BytesIO

import pytest
from fastapi.testclient import TestClient

from forma.domains.furniture.pricing import ITEMS, EstimateRequest, estimate_wardrobe
from forma.main import create_app
from PIL import Image

CONFIG = dict(width_mm=800, height_mm=2000, depth_mm=600, doors_count=2, shelves_count=3)


def payload(price="10", **changes):
    return dict(configuration=CONFIG, confirmed=True, price_catalog=[
        dict(item_code=code, item_name=name, unit=unit, unit_price_ron=price,
             updated_at="2026-11-12T10:00:00Z") for code, (name, unit) in ITEMS.items()
    ]) | changes


def calculate(**changes):
    return estimate_wardrobe(EstimateRequest.model_validate(payload(**changes)))


def test_quantities_multiplication_and_zero_defaults():
    result = calculate()
    lines = {line.item_code: line for line in result.material_lines + result.hardware_lines}
    assert lines["pal_18"].base_quantity == Decimal("6.162224")
    assert lines["abs_2"].base_quantity == Decimal("17.392")
    assert [lines[key].base_quantity for key in list(ITEMS)[4:]] == [8, 12, 2, 8, 40]
    assert lines["pal_18"].line_total_ron == Decimal("61.62")
    assert result.material_subtotal_ron == Decimal("251.54")
    assert result.hardware_subtotal_ron == Decimal("700.00")
    assert result.selling_price_before_tax_ron == Decimal("951.54")
    assert result.labor_cost_ron == result.markup_amount_ron == 0
    assert result.is_complete


@pytest.mark.parametrize("kind,code,quantity", [("pal", "pal_18", "6.162224"), ("hdf", "hdf_3", "1.6"), ("abs", "abs_2", "17.392")])
def test_independent_allowances_do_not_change_net_or_hardware(kind, code, quantity):
    result = calculate(waste_allowances={kind: "12.5"})
    line = next(line for line in result.material_lines if line.item_code == code)
    assert line.base_quantity == Decimal(quantity)
    assert line.billable_quantity == Decimal(quantity) * Decimal("1.125")
    assert all(line.base_quantity == line.billable_quantity for line in result.hardware_lines)


def test_labor_markup_and_explicit_rounding():
    result = calculate(labor_cost_ron="100.005", markup_percent="10")
    assert result.labor_cost_ron == Decimal("100.01")
    assert result.production_cost_ron == Decimal("1051.55")
    assert result.markup_amount_ron == Decimal("105.16")
    assert result.selling_price_before_tax_ron == Decimal("1156.71")


def test_missing_zero_and_unused_prices_are_distinct():
    absent = calculate(price_catalog=[])
    assert not absent.is_complete and absent.selling_price_before_tax_ron is None
    assert "pal_18" in absent.missing_item_codes
    assert "abs_0_4" not in absent.missing_item_codes
    assert absent.material_lines[0].line_total_ron is None
    zero = calculate(price="0")
    assert zero.is_complete and zero.selling_price_before_tax_ron == 0
    entries = payload()["price_catalog"]
    assert calculate(price_catalog=[entry for entry in entries if entry["item_code"] != "abs_0_4"]).is_complete


@pytest.mark.parametrize("field,value", [
    ("labor_cost_ron", "-1"), ("labor_cost_ron", "NaN"), ("labor_cost_ron", "Infinity"),
    ("markup_percent", "-1"), ("markup_percent", "100.01"),
    ("waste_allowances", {"pal": "101"}), ("waste_allowances", {"abs": "-1"}),
    ("waste_allowances", {"hdf": "NaN"}), ("confirmed", False), ("quantities", {"pal": 1}),
])
def test_invalid_inputs_are_rejected(field, value):
    with TestClient(create_app()) as client:
        assert client.post("/api/v1/furniture/estimate", json=payload(**{field: value})).status_code == 422


@pytest.mark.parametrize("change", [{"unit_price_ron": "-1"}, {"unit_price_ron": "NaN"}, {"unit": "m"}, {"source_type": "supplier_api"}, {"updated_at": "2026-11-12T10:00:00"}])
def test_invalid_catalog_entries(change):
    data = payload()
    data["price_catalog"][0].update(change)
    with TestClient(create_app()) as client:
        assert client.post("/api/v1/furniture/estimate", json=data).status_code == 422


def test_duplicate_codes_rejected_and_deterministic_api():
    data = payload()
    with TestClient(create_app()) as client:
        first = client.post("/api/v1/furniture/estimate", json=data)
        assert first.status_code == 200
        assert first.json() == client.post("/api/v1/furniture/estimate", json=data).json()
        assert first.json()["selling_price_before_tax_ron"] == "951.54"
        data["price_catalog"].append(data["price_catalog"][0])
        assert client.post("/api/v1/furniture/estimate", json=data).status_code == 422


def test_upload_mock_confirmation_quantities_and_pricing_workflow():
    image = BytesIO()
    Image.new("RGB", (8, 8), "white").save(image, format="PNG")
    with TestClient(create_app()) as client:
        interpretation = client.post("/api/v1/furniture/analyze-sketch", files={"file": ("sketch.png", image.getvalue(), "image/png")}).json()
        assert interpretation["is_mock"] is True
        configuration = {key: interpretation[key] for key in CONFIG}
        configuration["width_mm"] = 801
        request = payload(configuration=configuration)
        quantities = client.post("/api/v1/furniture/calculate", json={"configuration": configuration, "confirmed": True}).json()
        result = client.post("/api/v1/furniture/estimate", json=request).json()
        assert result["is_complete"]
        assert result["material_lines"][0]["base_quantity"] == quantities["totals"]["total_pal_area_m2"]
        assert result["material_lines"][2]["base_quantity"] == quantities["edge_banding"]["totals_by_type"]["abs_2_total_m"]
