"""Manual price sourcing and source-independent Decimal cost estimation."""

from datetime import datetime
from decimal import Context, Decimal, ROUND_HALF_UP, localcontext
from typing import Annotated, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .panel_calculation import calculate_wardrobe
from .schemas import ConfirmedWardrobeConfiguration, WardrobeConfiguration

Amount = Annotated[Decimal, Field(ge=0, le=1000000000, max_digits=18, decimal_places=6, allow_inf_nan=False)]
Percent = Annotated[Decimal, Field(ge=0, le=100, max_digits=9, decimal_places=6, allow_inf_nan=False)]

# Codes are independent of labels and are the matching contract for future providers.
ITEMS = {
    "pal_18": ("PAL 18 mm", "m²"), "hdf_3": ("HDF 3 mm", "m²"),
    "abs_2": ("ABS 2 mm", "m"), "abs_0_4": ("ABS 0,4 mm", "m"),
    "hinges": ("Balamale", "buc."), "shelf_supports": ("Suporți polițe", "buc."),
    "handles": ("Mânere", "buc."), "cabinet_connectors": ("Conectori carcasă", "buc."),
    "hdf_fasteners": ("Elemente fixare HDF", "buc."),
}


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class PriceEntry(Contract):
    item_code: str = Field(min_length=1, max_length=100)
    item_name: str = Field(min_length=1, max_length=200)
    unit: Literal["m²", "m", "buc."]
    unit_price_ron: Amount
    currency: Literal["RON"] = "RON"
    source_type: Literal["manual"] = "manual"
    source_name: str = Field(default="Introducere manuală", min_length=1, max_length=200)
    updated_at: datetime

    @field_validator("updated_at")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("Price timestamp must include a timezone.")
        return value


class Allowances(Contract):
    pal: Percent = Decimal(0)
    hdf: Percent = Decimal(0)
    abs: Percent = Decimal(0)


class EstimateRequest(ConfirmedWardrobeConfiguration):
    price_catalog: tuple[PriceEntry, ...] = Field(default=(), max_length=100)
    waste_allowances: Allowances = Allowances()
    labor_cost_ron: Amount = Decimal(0)
    markup_percent: Percent = Decimal(0)

    @field_validator("price_catalog")
    @classmethod
    def validate_catalog(cls, entries: tuple[PriceEntry, ...]) -> tuple[PriceEntry, ...]:
        if len({entry.item_code for entry in entries}) != len(entries):
            raise ValueError("Duplicate item codes are not allowed.")
        for entry in entries:
            if entry.item_code not in ITEMS or entry.unit != ITEMS[entry.item_code][1]:
                raise ValueError("Unknown item code or incompatible unit.")
        return entries


class PriceProvider(Protocol):
    """Future authorized adapters normalize prices to this boundary before estimation."""

    def get_price(self, item_code: str) -> PriceEntry | None: ...


class ManualPriceProvider:
    def __init__(self, entries: tuple[PriceEntry, ...]):
        self.entries = {entry.item_code: entry for entry in entries}

    def get_price(self, item_code: str) -> PriceEntry | None:
        return self.entries.get(item_code)


class CostLine(Contract):
    item_code: str
    name: str
    base_quantity: Decimal
    billable_quantity: Decimal
    unit: str
    unit_price_ron: Decimal | None
    line_total_ron: Decimal | None
    source_type: str | None


class EstimateResult(Contract):
    configuration: WardrobeConfiguration
    price_sources: tuple[PriceEntry, ...]
    material_lines: tuple[CostLine, ...]
    hardware_lines: tuple[CostLine, ...]
    labor_cost_ron: Decimal
    material_subtotal_ron: Decimal | None
    hardware_subtotal_ron: Decimal | None
    production_cost_ron: Decimal | None
    markup_percent: Decimal
    markup_amount_ron: Decimal | None
    selling_price_before_tax_ron: Decimal | None
    is_complete: bool
    missing_item_codes: tuple[str, ...]
    warnings: tuple[str, ...]


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def estimate_wardrobe(request: EstimateRequest, provider: PriceProvider | None = None) -> EstimateResult:
    quantities = calculate_wardrobe(ConfirmedWardrobeConfiguration(configuration=request.configuration, confirmed=True))
    prices = provider if provider is not None else ManualPriceProvider(request.price_catalog)
    with localcontext(Context(prec=40)):
        sources: list[PriceEntry] = []
        missing: list[str] = []

        def line(code: str, quantity: Decimal, allowance: Decimal = Decimal(0)) -> CostLine:
            price = prices.get_price(code)
            if price and (price.item_code != code or price.unit != ITEMS[code][1]):
                raise ValueError("Provider returned an incompatible price.")
            if price:
                sources.append(price)
            elif quantity > 0:
                missing.append(code)
            billable = quantity * (1 + allowance / 100)
            return CostLine(item_code=code, name=ITEMS[code][0], base_quantity=quantity,
                            billable_quantity=billable, unit=ITEMS[code][1],
                            unit_price_ron=price.unit_price_ron if price else None,
                            line_total_ron=money(billable * price.unit_price_ron) if price else (Decimal("0.00") if quantity == 0 else None),
                            source_type=price.source_type if price else None)

        materials = (
            line("pal_18", quantities.totals.total_pal_area_m2, request.waste_allowances.pal),
            line("hdf_3", quantities.totals.total_hdf_area_m2, request.waste_allowances.hdf),
            line("abs_2", quantities.edge_banding.totals_by_type.abs_2_total_m, request.waste_allowances.abs),
            line("abs_0_4", quantities.edge_banding.totals_by_type.abs_0_4_total_m, request.waste_allowances.abs),
        )
        hardware = tuple(line(item.id, Decimal(item.quantity)) for item in quantities.hardware.items)

        def subtotal(lines: tuple[CostLine, ...]) -> Decimal | None:
            if any(item.line_total_ron is None for item in lines):
                return None
            return money(sum((item.line_total_ron for item in lines if item.line_total_ron is not None), Decimal(0)))

        material_cost, hardware_cost = subtotal(materials), subtotal(hardware)
        labor = money(request.labor_cost_ron)
        production = money(material_cost + hardware_cost + labor) if not missing else None
        markup = money(production * request.markup_percent / 100) if production is not None else None
        return EstimateResult(configuration=request.configuration, price_sources=tuple(sources),
                              material_lines=materials, hardware_lines=hardware, labor_cost_ron=labor,
                              material_subtotal_ron=material_cost, hardware_subtotal_ron=hardware_cost,
                              production_cost_ron=production, markup_percent=request.markup_percent,
                              markup_amount_ron=markup,
                              selling_price_before_tax_ron=production + markup if production is not None else None,
                              is_complete=not missing, missing_item_codes=tuple(missing),
                              warnings=tuple(f"Lipsește prețul pentru {ITEMS[code][0]}." for code in missing) + (
                                  "Estimare fără TVA. Adaosul comercial nu reprezintă marja de profit.",
                                  "Pierderile sunt adaosuri pentru cost, nu optimizare de debitare. Feroneria rămâne estimativă.",))
