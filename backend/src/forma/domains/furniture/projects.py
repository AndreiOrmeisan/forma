"""Persist validated inputs, not derived totals or temporary sketch references."""

from typing import Literal
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from .pricing import Allowances, Amount, Contract, EstimateRequest, Percent, PriceEntry, ITEMS, estimate_wardrobe
from .schemas import WardrobeConfiguration
from .wardrobe_geometry import PROFILE
from .manufacturing import ManufacturingSnapshot

SCHEMA_VERSION = 1
CALCULATION_VERSION = "wardrobe-v1"


class InvalidStoredProject(Exception):
    pass


class ProjectPriceSnapshot(Contract):
    item_code: str
    unit_price_ron: Amount | None
    normalized_unit: Literal["m²", "m", "buc."]
    supplier_id: UUID | None = None
    supplier_name: str | None = Field(default=None, max_length=120)
    catalog_item_id: UUID | None = None
    applied_at: datetime
    source_type: Literal["manual", "manual_catalog"]
    is_override: bool = Field(strict=True)

    @field_validator("applied_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("Price snapshot timestamp must have a timezone.")
        return value

    @model_validator(mode="after")
    def compatible_item(self) -> "ProjectPriceSnapshot":
        if self.item_code not in ITEMS or self.normalized_unit != ITEMS[self.item_code][1]:
            raise ValueError("Snapshot item/unit is not supported.")
        if self.source_type == "manual_catalog" and (self.catalog_item_id is None or self.is_override or self.unit_price_ron is None):
            raise ValueError("Catalog snapshots require an offer and a price.")
        if self.unit_price_ron is None and not self.is_override:
            raise ValueError("A cleared price must be an explicit manual override.")
        return self


class ProjectInput(Contract):
    domain: Literal["furniture"] = "furniture"
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    status: Literal["draft", "completed"] = "draft"
    confirmed_configuration: WardrobeConfiguration
    manual_price_catalog: tuple[PriceEntry, ...] = Field(default=(), max_length=100)
    waste_allowances: Allowances = Allowances()
    labor_cost: Amount = Decimal(0)
    markup_percentage: Percent = Decimal(0)
    schema_version: Literal[1] = SCHEMA_VERSION
    construction_profile_id: Literal["forma-wardrobe-poc-v1"] = PROFILE.id
    calculation_version: Literal["wardrobe-v1"] = CALCULATION_VERSION
    price_snapshots: tuple[ProjectPriceSnapshot, ...] = Field(default=(), max_length=9)
    manufacturing_snapshot: ManufacturingSnapshot | None = None

    @field_validator("name", mode="before")
    @classmethod
    def clean_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("schema_version", mode="before")
    @classmethod
    def strict_schema(cls, value: object) -> object:
        if type(value) is not int or value != SCHEMA_VERSION:
            raise ValueError("Unsupported project schema version.")
        return value

    def estimate_request(self) -> EstimateRequest:
        return EstimateRequest(configuration=self.confirmed_configuration, confirmed=True,
                               price_catalog=self.manual_price_catalog, waste_allowances=self.waste_allowances,
                               labor_cost_ron=self.labor_cost, markup_percent=self.markup_percentage)

    @model_validator(mode="after")
    def validate_pricing(self) -> "ProjectInput":
        self.estimate_request()
        if len({s.item_code for s in self.price_snapshots}) != len(self.price_snapshots):
            raise ValueError("Duplicate project price snapshots.")
        entries = {entry.item_code: entry.unit_price_ron for entry in self.manual_price_catalog}
        for snapshot in self.price_snapshots:
            if entries.get(snapshot.item_code) != snapshot.unit_price_ron:
                raise ValueError("Snapshot must match the stored project unit price.")
        return self


class ProjectPatch(Contract):
    expected_revision: int = Field(strict=True, ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    status: Literal["draft", "completed"] | None = None
    confirmed_configuration: WardrobeConfiguration | None = None
    manual_price_catalog: tuple[PriceEntry, ...] | None = Field(default=None, max_length=100)
    waste_allowances: Allowances | None = None
    labor_cost: Amount | None = None
    markup_percentage: Percent | None = None
    price_snapshots: tuple[ProjectPriceSnapshot, ...] | None = Field(default=None, max_length=9)
    manufacturing_snapshot: ManufacturingSnapshot | None = None

    @model_validator(mode="after")
    def no_null_required_fields(self) -> "ProjectPatch":
        if any(getattr(self, field) is None for field in self.model_fields_set - {"description", "manufacturing_snapshot"}):
            raise ValueError("Required project fields cannot be null.")
        return self


class ProjectRecord(Contract):
    id: UUID
    domain: Literal["furniture"] = "furniture"
    name: str
    description: str | None
    status: Literal["draft", "completed"]
    confirmed_configuration: WardrobeConfiguration
    manual_price_catalog: tuple[PriceEntry, ...]
    waste_allowances: Allowances
    labor_cost: Amount
    markup_percentage: Percent
    created_at: datetime
    updated_at: datetime
    schema_version: int
    construction_profile_id: str
    calculation_version: str
    revision: int
    compatible: bool
    deviz_complete: bool | None
    warnings: tuple[str, ...]
    price_snapshots: tuple[ProjectPriceSnapshot, ...] = ()
    manufacturing_snapshot: ManufacturingSnapshot | None = None

    @field_validator("created_at", "updated_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("Stored project timestamps must include UTC offset.")
        return value


class ProjectPage(Contract):
    items: tuple[ProjectRecord, ...]
    total: int
    limit: int
    offset: int


def record_from_row(row) -> ProjectRecord:
    import json

    payload = json.loads(row["payload"])
    if not isinstance(payload, dict):
        raise InvalidStoredProject
    # Preserve historical version identifiers. Never silently migrate calculation rules.
    compatible = (payload.get("schema_version") == SCHEMA_VERSION and
                  payload.get("construction_profile_id") == PROFILE.id and
                  payload.get("calculation_version") == CALCULATION_VERSION)
    complete = None
    if compatible:
        complete = estimate_wardrobe(ProjectInput.model_validate(payload).estimate_request()).is_complete
    return ProjectRecord.model_validate(payload | {
        "id": row["id"], "created_at": row["created_at"], "updated_at": row["updated_at"],
        "revision": row["revision"], "compatible": compatible, "deviz_complete": complete,
        "warnings": () if compatible else ("Versiunea proiectului nu este compatibilă. Recalcularea și editarea sunt blocate pentru a proteja datele istorice.",),
    })
