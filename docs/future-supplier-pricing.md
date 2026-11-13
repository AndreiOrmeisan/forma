# Future supplier pricing

See the [documentation index](README.md), [wardrobe engine](wardrobe-engine.md) and [project persistence](project-persistence.md) for related context. This guide describes current manual pricing and future supplier preparation, not an active external pricing integration.

Quantity calculation, price sourcing, and cost estimation are separate responsibilities. The furniture engine recalculates quantities from confirmed configuration; clients cannot submit authoritative material quantities. `pricing.py` defines stable item codes, validated price entries, a small `PriceProvider` protocol and the only implemented adapter, `ManualPriceProvider`. The cost engine reads normalized entries, not provider-specific payloads. The HTTP boundary currently accepts manual RON prices only.

Sprint 11 implements a user-maintained [browser supplier catalog](supplier-catalog.md), not an external supplier integration. Its only price source is `ManualCatalogPriceSource`; the existing backend manual price contract and Decimal cost engine remain authoritative. Frozen project snapshots separately record catalog provenance and manual overrides. No supplier database or public supplier CRUD exists.

Future adapters may use official APIs or authorized product feeds only. No scraping, external pricing requests, scheduled synchronization or functioning external supplier integration exists now. Extend the validated source contract when implementing an actual external adapter; never relabel externally fetched supplier prices as manual.

An adapter should preserve supplier name, supplier product identifier, product URL when supplied, original unit/currency, normalized unit price, last-updated timestamp and optional availability. Match products to stable item codes using material, thickness, edge type and hardware specifications, not display-name similarity. Normalize packs, sheet areas, lengths and pieces explicitly; reject ambiguous units. RON is the sole supported currency today; currency conversion requires an explicit future policy.

Prices can depend on supplier, account, quantity, transport and tax conditions. Expose freshness and supplier-specific terms. Availability is uncertain even when a feed reports stock. Missing, stale, invalid or unavailable prices must produce an incomplete estimate or require explicit user confirmation, never silently become zero. External failures must preserve the manual catalog and allow manual fallback. Users must confirm matches, provenance, units and timestamps before external prices replace their inputs.

## Current arithmetic and lifecycle

Material billable quantity = net quantity × (1 + allowance / 100). PAL, HDF and ABS allowances default to zero and range from 0 to 100%. Hardware uses unchanged integer quantities. This is cost allowance, not nesting optimization; cutting dimensions remain unchanged.

All costs use Python Decimal (40-digit local context). Line totals round HALF_UP to cents; subtotals sum these rounded lines. Fixed labor rounds HALF_UP to cents. Production = materials + hardware + labor. Markup = production × markup percentage / 100, rounded HALF_UP to cents. Selling price before tax = production + rounded markup. Markup is not profit margin. No VAT is added. Percentages are bounded at 100%, prices/labor at 1 billion RON; inputs allow up to six decimals.

A missing price differs from explicit zero. Only positive-quantity items require a price. A zero-quantity line may have no price and contributes zero. Incomplete category subtotals and final totals are null; missing codes and warnings are returned. Known category subtotals cannot be presented as a complete selling price.

Manual entries start empty. Unsaved prices/allowances live in temporary context until a successful project save. Default POC mode then persists these inputs in browser localStorage; optional API mode uses SQLite/cloud storage instead. No images or authoritative totals are persisted. Mode preference and optional SDK session use separate keys. Refresh loses unsaved image workflows; saved inputs reload in the editor even if the calculation backend is unavailable. Estimates still come from the backend; changed inputs hide stale totals until reapplied. See [browser saving](browser-projects.md) for storage limitations.
