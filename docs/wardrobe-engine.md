# Deterministic wardrobe engine reference

These are the implemented POC rules, not a general furniture standard or manufacturing certification. Source is [wardrobe_geometry.py](../backend/src/forma/domains/furniture/wardrobe_geometry.py), [panel_calculation.py](../backend/src/forma/domains/furniture/panel_calculation.py) and the related schema/rule modules. Pricing is described separately in [future supplier pricing](future-supplier-pricing.md).

## Interpretation, validation and confirmation

`POST /api/v1/furniture/analyze-sketch` accepts multipart field `file`: JPEG/PNG/WebP up to 10 MB. MIME, size and decoding are validated. The fixed mock returns width 800 mm, height 2000 mm, depth 600 mm, two doors, three shelves, `furniture_type=wardrobe`, `is_mock=true` and `requires_confirmation=true`. This is demonstration data independent of the uploaded image, not AI analysis. HEIC is not supported.

| Field | Inclusive integer range |
| --- | --- |
| `width_mm` | 300–2400 |
| `height_mm` | 400–3000 |
| `depth_mm` | 200–1000 |
| `doors_count` | 1–2 |
| `shelves_count` | 0–10 |

Backend input rules live in [schemas.py](../backend/src/forma/domains/furniture/schemas.py); keep frontend [wardrobe-configuration.ts](../frontend/src/features/furniture/wardrobe-configuration.ts) aligned. Frontend draft strings may temporarily be invalid; do not coerce them into a valid configuration or render invalid SVG coordinates.

`POST /api/v1/furniture/calculate` accepts only a confirmed configuration:

```json
{
  "configuration": {
    "width_mm": 800,
    "height_mm": 2000,
    "depth_mm": 600,
    "doors_count": 2,
    "shelves_count": 3,
    "furniture_type": "wardrobe"
  },
  "confirmed": true
}
```

False/missing confirmation, invalid inputs and extra mock metadata are rejected. An image is not needed for deterministic calculation. Decimal dimensions/areas cross JSON as strings; do not replace exact backend quantities with JavaScript floating-point totals.

## Construction profile and panel geometry

Profile: `forma-wardrobe-poc-v1` (FORMA POC v1). Saved projects also record `calculation_version=wardrobe-v1` and `schema_version=1`. Changes affecting historical results require a version/compatibility decision rather than silently recalculating older projects under changed assumptions.

- Rectangular freestanding wardrobe, full-height sides, one continuous interior bay even with two doors.
- PAL thickness 18 mm; top/bottom and shelves fit between the sides.
- Shelf depth setback 50 mm.
- Applied hinged doors: 2 mm outer side gaps, 2 mm top/bottom gaps and 2 mm between two doors.
- Separate surface-mounted HDF back, 3 mm; no grooved-back deduction.
- Grain/decor orientation remains unspecified. There is no sheet nesting or stock-sheet purchasing optimization.

Let cabinet dimensions be W × H × D (mm), shelf count S and door count N:

| Stable panel ID | Piece dimensions (length × width, mm) | Quantity / material |
| --- | --- | --- |
| `sides` | H × D | 2 / PAL |
| `top` | (W − 36) × D | 1 / PAL |
| `bottom` | (W − 36) × D | 1 / PAL |
| `shelves` | (W − 36) × (D − 50) | S / PAL; row omitted when S=0 |
| `doors` | (H − 4) × (W − 4) for N=1; (H − 4) × ((W − 6)/2) for N=2 | N / PAL |
| `back` | W × H | 1 / HDF |

Single-piece area = length × width / 1,000,000. `unit_area_m2` is per piece; `area_m2` includes the row quantity. PAL and HDF totals remain separate. An 801 mm wide two-door cabinet produces doors 397.5 mm wide; do not round away the fraction.

## ABS edges

[edge_banding_rules.py](../backend/src/forma/domains/furniture/edge_banding_rules.py) assigns metadata; [edge_banding.py](../backend/src/forma/domains/furniture/edge_banding.py) consumes the actual calculated panels.

For panel length axis L and width axis W:

- `length_start` / `length_end`: edges at the ends of L, each measuring panel `width_mm`.
- `width_start` / `width_end`: edges at the ends of W, each measuring panel `length_mm`.
- For sides/top/bottom/shelves, `width_start` is the front edge.

Front carcass/shelf edges and all four door edges receive ABS 2 mm. Other edges are `none`; HDF has `edges: null` and is excluded. The schema supports `abs_0_4`, whose default assigned total is zero. Per-edge, per-panel and type totals use exact net meters including quantity. `procurement_allowance_m` is separately zero in this construction response. Pricing waste allowances affect billable cost quantities only and do not rewrite these net lengths or cutting dimensions.

## Preliminary hardware

[hardware_rules.py](../backend/src/forma/domains/furniture/hardware_rules.py) and [hardware.py](../backend/src/forma/domains/furniture/hardware.py) use the same panel geometry:

| Item code | Rule |
| --- | --- |
| `hinges` | Per actual door-panel height: <=900 mm → 2; <=1600 → 3; <=2200 → 4; above → 5. Multiply by door quantity. |
| `shelf_supports` | Four per configured adjustable shelf. |
| `handles` | One per door. |
| `cabinet_connectors` | Four per horizontal top/bottom assembly, eight in this profile. |
| `hdf_fasteners` | Per back panel: `2 × (ceil(length/150) + ceil(width/150))`, then multiply by back quantity. |

HDF perimeter intervals are at most 150 mm with shared corners counted once. Hinge and HDF quantities are preliminary; manufacturer specifications, door weight/material/width and real installation affect final selection and positioning. No hardware waste percentage is applied; hardware counts remain integers.

## Regression example and composition

For the confirmed 800 × 2000 × 600 mm wardrobe, two doors, three shelves:

- PAL: **6.162224 m²**, HDF: **1.6 m²**, total pieces: **10**.
- ABS 2 mm: `(2×2000 + (2+3)×764 + 2×2×(1996+397))/1000 = 17.392 m`.
- ABS 0.4 mm: zero; procurement allowance: zero.
- Hardware: 8 hinges, 12 supports, 2 handles, 8 connectors, 40 HDF fasteners = **70 pieces**.

Geometry, areas, banding and hardware compose atomically; a failed part must not produce a misleading partial successful result. The frontend validates complete responses and panel/edge associations. The 2D SVG is a configuration aid driven by current editable inputs, with schematic panel thickness and depth displayed numerically, not a manufacturing drawing or 3D model.
