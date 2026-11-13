"""Opt-in finished/raw dimension adapter; legacy geometry and pricing stay intact."""

from datetime import datetime
from decimal import Context, Decimal, ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP, localcontext
from typing import Annotated, Literal
from uuid import UUID
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .panel_calculation import calculate_wardrobe
from .schemas import ConfirmedWardrobeConfiguration, Panel

DIMENSIONAL_PROFILE_ID = "forma-wardrobe-manufacturing-v1"
DIMENSIONAL_CALCULATION_VERSION = "manufacturing-dimensions-v1"
EdgeType = Literal["abs_0_4", "abs_2"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    @field_validator("schema_version", mode="before", check_fields=False)
    @classmethod
    def strict_version(cls, value: object) -> object:
        if type(value) is not int or value != 1:
            raise ValueError("Unsupported manufacturing schema version.")
        return value


def exact_decimal(value: object) -> object:
    if value is not None and (not isinstance(value, str) or len(value) > 24 or not re.fullmatch(r"-?\d+(?:\.\d{1,6})?", value)):
        raise ValueError("Manufacturing millimeters must be bounded decimal strings, not JSON floats.")
    return value


Mm = Annotated[Decimal, Field(ge=0, le=20, max_digits=9, decimal_places=6, allow_inf_nan=False)]
NetMm = Annotated[Decimal, Field(ge=-20, le=20, max_digits=9, decimal_places=6, allow_inf_nan=False)]
ProjectionMm = Annotated[Decimal, Field(ge=0, le=1000, max_digits=10, decimal_places=6, allow_inf_nan=False)]


class NetRule(Contract):
    mode: Literal["net"]
    net_contribution_mm: NetMm | None = None

    _exact = field_validator("net_contribution_mm", mode="before")(exact_decimal)


class LayerRule(Contract):
    mode: Literal["layers"]
    applied_thickness_mm: Mm | None = None
    removal_mm: Mm | None = None

    _exact = field_validator("applied_thickness_mm", "removal_mm", mode="before")(exact_decimal)


ProcessingRule = Annotated[NetRule | LayerRule, Field(discriminator="mode")]


class ManufacturingProfile(Contract):
    id: UUID
    name: str = Field(min_length=1, max_length=120)
    supplier_id: UUID | None = None
    schema_version: Literal[1]
    revision: int = Field(strict=True, ge=1)
    status: Literal["draft", "validated", "archived"]
    supported_edge_types: tuple[EdgeType, ...] = Field(max_length=2)
    edge_processing_rules: dict[EdgeType, ProcessingRule]
    cutting_precision_mm: Mm | None = None
    rounding_policy: Literal["half_up", "ceil", "floor", "exact"] | None = None
    dimensional_tolerance_mm: Mm | None = None
    depth_convention: Literal["carcass_plus_projections_v1"]
    back_projection_mm: ProjectionMm | None = None
    front_projection_mm: ProjectionMm | None = None
    notes: str = Field(max_length=2000)
    created_at: datetime
    updated_at: datetime

    _exact = field_validator("cutting_precision_mm", "dimensional_tolerance_mm", "back_projection_mm", "front_projection_mm", mode="before")(exact_decimal)

    @field_validator("created_at", "updated_at")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("Profile timestamps require a timezone.")
        return value

    @model_validator(mode="after")
    def valid_parameters(self):
        if not self.name.strip() or self.updated_at < self.created_at:
            raise ValueError("Invalid profile name/timestamps.")
        if len(set(self.supported_edge_types)) != len(self.supported_edge_types):
            raise ValueError("Duplicate supported edge type.")
        if set(self.edge_processing_rules) - set(self.supported_edge_types):
            raise ValueError("Rules must belong to an explicitly supported edge type.")
        if self.cutting_precision_mm is not None and self.cutting_precision_mm <= 0:
            raise ValueError("Cutting precision must be positive.")
        if self.status == "validated" and missing_settings(self):
            raise ValueError("An incomplete profile cannot be explicitly validated.")
        return self


def contribution(rule: ProcessingRule | None) -> Decimal | None:
    if rule is None:
        return None
    if isinstance(rule, NetRule):
        return rule.net_contribution_mm
    if rule.applied_thickness_mm is None or rule.removal_mm is None:
        return None
    return rule.applied_thickness_mm - rule.removal_mm


def missing_settings(profile: ManufacturingProfile) -> list[str]:
    missing = []
    for edge in profile.supported_edge_types:
        if contribution(profile.edge_processing_rules.get(edge)) is None:
            missing.append(f"Regulă completă pentru {edge} (zero trebuie introdus explicit).")
    for field, label in [("cutting_precision_mm", "Precizia debitării"), ("rounding_policy", "Politica de rotunjire"),
                         ("dimensional_tolerance_mm", "Toleranța dimensională"), ("back_projection_mm", "Proiecția spatelui"),
                         ("front_projection_mm", "Proiecția frontului")]:
        if getattr(profile, field) is None:
            missing.append(f"{label}: neconfigurată.")
    return missing


class ManufacturingSnapshot(Contract):
    schema_version: Literal[1]
    dimensional_profile_id: Literal["forma-wardrobe-manufacturing-v1"]
    calculation_version: Literal["manufacturing-dimensions-v1"]
    geometry_basis: Literal["forma-wardrobe-poc-v1"]
    selected_at: datetime
    approval_status: Literal["draft", "validated", "archived"]
    supplier_name_at_selection: str | None = Field(default=None, max_length=120)
    supplier_status_at_selection: Literal["standalone", "active", "archived", "missing"]
    profile: ManufacturingProfile

    @model_validator(mode="after")
    def consistent_selection(self):
        if self.selected_at.utcoffset() is None or self.approval_status != self.profile.status:
            raise ValueError("Snapshot approval/date does not match the selected profile.")
        if (self.profile.supplier_id is None) != (self.supplier_status_at_selection == "standalone"):
            raise ValueError("Supplier association is inconsistent.")
        return self


class ManufacturingRequest(ConfirmedWardrobeConfiguration):
    snapshot: ManufacturingSnapshot


class ProductionPanel(Contract):
    panel_id: str
    name: str
    quantity: int
    finished_length_mm: Decimal
    finished_width_mm: Decimal
    raw_length_mm: Decimal | None
    raw_width_mm: Decimal | None
    cutting_length_mm: Decimal | None
    cutting_width_mm: Decimal | None
    edges: dict[str, str]
    issues: tuple[str, ...]


class ManufacturingResult(Contract):
    dimensional_profile_id: Literal["forma-wardrobe-manufacturing-v1"] = DIMENSIONAL_PROFILE_ID
    calculation_version: Literal["manufacturing-dimensions-v1"] = DIMENSIONAL_CALCULATION_VERSION
    configuration: dict
    profile_id: UUID
    profile_revision: int
    readiness: Literal["configuration_incomplete", "calculation_ready_unverified"]
    panels: tuple[ProductionPanel, ...]
    carcass_depth_mm: Decimal
    back_projection_mm: Decimal | None
    front_projection_mm: Decimal | None
    overall_depth_mm: Decimal | None
    issues: tuple[str, ...]
    warnings: tuple[str, ...]


def panel_dimensions(panel: Panel, profile: ManufacturingProfile) -> ProductionPanel:
    # Local panel coordinates, not cabinet orientation: top/bottom are the
    # length-axis ends; left/right are width-axis ends. No grain inference.
    legacy = panel.edges.model_dump() if panel.edges else {edge: "none" for edge in ("length_start", "length_end", "width_start", "width_end")}
    edges = dict(zip(("top", "bottom", "left", "right"), legacy.values(), strict=True))
    issues = []

    def raw(finished: Decimal, relevant: tuple[str, str]) -> Decimal | None:
        total = Decimal(0)
        for edge in relevant:
            band = edges[edge]
            if band == "none":
                continue
            value = contribution(profile.edge_processing_rules.get(band)) if band in profile.supported_edge_types else None
            if value is None:
                issues.append(f"{panel.name} / {edge}: regulă {band} neconfigurată.")
                return None
            total += value
        result = finished - total
        if result <= 0:
            issues.append(f"{panel.name}: dimensiune brută nulă sau negativă.")
            return None
        return result

    def cutting(value: Decimal | None) -> Decimal | None:
        precision = profile.cutting_precision_mm
        policy = profile.rounding_policy
        if value is None or precision is None or policy is None:
            return None
        units = value / precision
        if policy == "exact":
            if units != units.to_integral_value():
                issues.append(f"{panel.name}: dimensiunea nu este multiplu exact al preciziei configurate.")
                return None
            result = value
        else:
            result = units.to_integral_value(rounding={"half_up": ROUND_HALF_UP, "ceil": ROUND_CEILING, "floor": ROUND_FLOOR}[policy]) * precision
        if result <= 0:
            issues.append(f"{panel.name}: rotunjirea produce o dimensiune nepozitivă.")
            return None
        if profile.dimensional_tolerance_mm is None:
            issues.append(f"{panel.name}: toleranța este neconfigurată.")
        elif abs(result - value) > profile.dimensional_tolerance_mm:
            issues.append(f"{panel.name}: abaterea de rotunjire depășește toleranța configurată.")
            return None
        return result

    length = raw(panel.length_mm, ("top", "bottom"))
    width = raw(panel.width_mm, ("left", "right"))
    cut_length, cut_width = cutting(length), cutting(width)
    return ProductionPanel(panel_id=panel.id, name=panel.name, quantity=panel.quantity,
                           finished_length_mm=panel.length_mm, finished_width_mm=panel.width_mm,
                           raw_length_mm=length, raw_width_mm=width, cutting_length_mm=cut_length,
                           cutting_width_mm=cut_width, edges=edges, issues=tuple(issues))


def calculate_manufacturing(request: ManufacturingRequest) -> ManufacturingResult:
    with localcontext(Context(prec=28)):
        legacy = calculate_wardrobe(ConfirmedWardrobeConfiguration(configuration=request.configuration, confirmed=True))
        profile = request.snapshot.profile
        panels = tuple(panel_dimensions(panel, profile) for panel in legacy.panels)
        issues = missing_settings(profile) + [issue for panel in panels for issue in panel.issues]
        if profile.status == "archived":
            issues.append("Profilul selectat este arhivat.")
        overall = None if profile.back_projection_mm is None or profile.front_projection_mm is None else Decimal(request.configuration.depth_mm) + profile.back_projection_mm + profile.front_projection_mm
        warnings = ["Dimensiuni brute neconfirmate — verificare în atelier necesară.",
                    "Suprafețele pentru prețuri și lungimile ABS păstrează baza nominală legacy; nu sunt suprafețe brute de achiziție.",
                    "Setările validate nu reprezintă dovada unei asamblări fizice testate."]
        if profile.status != "validated":
            warnings.append("Profilul nu are setările validate explicit.")
        if request.snapshot.supplier_status_at_selection in ("missing", "archived"):
            warnings.append("Furnizorul era indisponibil la selectare; asocierea a fost păstrată.")
        return ManufacturingResult(configuration=request.configuration.model_dump(), profile_id=profile.id,
                                   profile_revision=profile.revision, readiness="configuration_incomplete" if issues else "calculation_ready_unverified",
                                   panels=panels, carcass_depth_mm=Decimal(request.configuration.depth_mm),
                                   back_projection_mm=profile.back_projection_mm, front_projection_mm=profile.front_projection_mm,
                                   overall_depth_mm=overall, issues=tuple(dict.fromkeys(issues)), warnings=tuple(warnings))
