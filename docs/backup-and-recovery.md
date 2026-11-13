# Local backup and recovery

Sprint 14C extends full export to `forma-backup` v2, adds `manufacturing_profiles` and project envelope v3 snapshots, and retains v1/catalog-only import. Manufacturing is a separately selectable furniture-owned section. V1 files cannot introduce manufacturing data. Journal v2 adds the manufacturing key/lock; supported v1 journals still recover. No automatic migration. See [manufacturing profiles](manufacturing-profiles.md).

Sprint 14B adds `/setari/backup-si-restaurare`, linked from the furniture profile and always accessible from catalog/company settings, even when their normal repository load fails. No account, network service, paid dependency or database flag is required. This feature operates on **browser-local** data even if another installation selects API project storage; it does not export SQLite/Supabase/server projects.

## File format and included data

UTF-8 JSON, safe filename `FORMA_Backup_YYYY-MM-DD.json` (UTC filename date):

```json
{
  "format": "forma-backup",
  "schema_version": 2,
  "created_at": "2026-11-13T12:00:00.000Z",
  "application": "FORMA",
  "sections": {
    "projects": [],
    "catalogs": [],
    "company_profile": null,
    "manufacturing_profiles": {"schema_version": 1, "domain_id": "furniture", "revision": 0, "profiles": []}
  }
}
```

Full exports contain all four sections. Partial backups may contain one or more; omitted sections cannot be selected. Empty arrays/null are valid. `projects` contains existing `{storage_version:1|2|3, project:...}` envelopes, preserving IDs, configuration, prices, supplier snapshots, optional manufacturing snapshots, historical timestamps and construction/calculation/schema metadata. Derived totals are not stored or invented. Legacy envelopes are not rewritten on open/backup; the existing reader may derive manual price snapshots in memory. No backend recalculation or current price/process refresh happens during restore. `manufacturing_profiles` holds the validated domain-bound profile store; merge skips conflicting IDs and explicit replacement rebases live profile revisions without changing applied project snapshots.

Each `catalogs` entry is `{domain_id:"furniture", catalog:{schema_version:1, revision, suppliers, items}}`. Furniture is the only currently implemented domain. Unknown domains are rejected, not mapped into furniture; unrelated domain keys remain untouched. A valid active legacy furniture catalog can be exported without creating/deleting its source key. `company_profile` is null or the existing validated profile: contact/registration details, quotation notes/validity and an optional bounded PNG/JPEG data URL logo. Existing logo constraints remain 128 KiB, 2048 × 2048 pixels and signature/format validation. Import reuses the stored-logo validator; it does not add an independent image decoder.

**Excluded:** uploaded sketch photographs, object URLs, unsaved drafts, auth sessions/tokens, preferences, generated PDFs, derived estimates and unrelated browser keys. Saved project inputs are enough to reopen/recalculate with the existing backend; photographs cannot be recovered from these backups.

## Export and import validation

The service reads through existing project/catalog/company repository validators, blocks a full export on corrupt/unknown-version owned records or a pending journal, and checks that the serialized file can be parsed by its importer before download. It never silently exports a partial full backup. A source change during export fails rather than presenting a mixed snapshot. The browser download action only prepares a file; the user must verify it was saved on their device.

File policy: catalog JSON **16 MiB**, full FORMA JSON **32 MiB**, measured with `TextEncoder` UTF-8 bytes. UI file size is checked before reading, then text bytes are checked before JSON parsing. Catalog export and import use the same policy and compact serialization; oversized valid catalogs fail clearly without truncation. Previous `forma-supplier-catalog` v1 files (with or without the furniture domain field) remain accepted, including by the full-backup page as catalog-only backups. Catalog record caps remain 500 suppliers / 3000 offers; full backup caps projects at 10000. The importer rejects extra fields, duplicate project IDs, invalid references/units/prices, incompatible envelope versions and malformed JSON. Invalid files produce an error and **no preview writes**; there is no partial salvage of invalid imported records.

Supported file sizes are parsing/export limits, not a promise that localStorage has that much free space. Browser quotas are often much smaller. No cap was removed and no records are truncated.

## Restore preview and modes

1. Select a local file. Review creation time/version, project/supplier/offer counts and company presence.
2. Choose available sections and merge/replace mode; click **Verifică backupul**. A captured raw baseline and deterministic validated change plan are held only in memory. The plan includes skipped conflicts, catalog preference warnings, affected local record counts and changes. Corrupt catalogs report an unknown affected count instead of inventing one.
3. **Merge:** preserve unrelated records and skip every conflicting project/supplier/offer ID. All skipped records are listed. Existing company profile wins. Existing preferred catalog offers retain priority, following the current catalog preview rules. No duplicate projects or regenerated UUIDs.
4. **Replace selected sections:** remove records absent from the selected imported section, replace conflicting records and leave all unselected sections untouched. This mode requires an explicit confirmation checkbox. Replacing the furniture catalog also removes its superseded legacy fallback key; the journal retains that raw previous value until commit/rollback.
5. **Restaurează** revalidates the backup/rebuilds the plan, rechecks selected-section baselines and then commits. **Anulează** writes nothing.

IDs, historical timestamps, configuration and prices are preserved. Restoring a conflicting valid project intentionally advances its revision to `max(current, incoming)+1`, so a normal older editor fails the existing revision check. A corrupt conflicting record has no trustworthy revision: the plan captures a safe integer time floor and advances above that and the incoming revision. Rebuilding the same plan uses that captured floor. New IDs imported into an empty store retain their incoming revisions. Catalog revisions advance on replacement/merge changes; historical supplier/offer timestamps stay unchanged. A changed project revision is concurrency metadata, not automatic recalculation of historical inputs.

Close other FORMA tabs before replacement/recovery and reopen editors afterward. Already-rendered states do not live-update or synchronize across tabs. Do not restore over an active unsaved workflow in another tab.

## Failure safety and actual atomicity

Implementation: `features/storage/forma-backup.ts` orchestrates existing validators; `restore-transaction.ts` is a bounded repository write coordinator, not a second project/catalog store. Normal project/catalog/company access checks the pending journal. The coordinator takes the existing project and furniture catalog Web Locks in a fixed order where available. Existing single-record revision guards remain in place. Company writes remain synchronous and journal-aware.

Before changing data, the coordinator verifies expected raw values and writes `forma:restore-journal:v1` containing each allowlisted key/section and exact `before`/`after` values (journal schema v2 when manufacturing profiles are touched, otherwise v1). Successfully storing it is the practical staging/capacity check: staging failure performs no data writes. Additional quota may still be needed. The journal is bounded at 20004 operations / 128 MiB; browser quota usually limits it earlier. Only owned project/furniture-catalog/company/manufacturing namespaces can be restored or rolled back.

Each localStorage operation is atomic for one key; **the entire restore is not a database transaction**. During a normal in-page failure, reverse rollback restores exact prior values and removes imported new keys. On interruption/crash, the journal remains; normal repository access is blocked until explicit recovery. Other browser contexts, old application versions and browsers without Web Locks do not provide serializable isolation. Raw baseline comparisons detect observed changes; they are not an atomic cross-tab compare-and-swap. Readers/writers from old code may ignore the journal. Browser/process/storage loss can destroy both data and journal; download a backup first.

Rollback checks whether each current value equals its `before` or planned `after`. It never blindly overwrites a different concurrent value. If a rollback write fails or a conflicting value appears, the error identifies the exact sections/keys, the journal remains downloadable, and normal writes stay blocked. Repeated rollback is safe for already-restored keys. If deleting the final journal fails, the operation is not reported as success. Journal schema/key/size validation applies before rollback.

## Corrupted data recovery

The backup page inspects supported raw keys without depending on a successful normal repository load. For each affected project/catalog/company record or pending journal:

- **Descarcă datele pentru recuperare** downloads `forma-raw-recovery` v1 with the key and exact raw text. Only allowlisted application data can be downloaded; authentication and unrelated keys are excluded. This diagnostic artifact is deliberately not a normal importable backup.
- For corrupt project/catalog/company sections, choose a valid backup, select only the affected section, choose replace, inspect and explicitly confirm. Unknown-version local data is never automatically deleted or rewritten on page open. Catalog/company recovery controls remain outside disabled normal forms.
- For an interrupted supported journal, close other tabs, download the journal, explicitly confirm **Revino la datele anterioare**, then inspect and retry the intended import.
- A malformed/future-version journal cannot be automatically interpreted, rolled back or deleted safely. Keep the raw artifact and seek developer-assisted recovery. The UI intentionally leaves it intact and blocks further restore/writes rather than guessing its meaning. No generic `localStorage.clear()` recovery exists.

Do not modify production or real user data to test corruption. Use a disposable browser profile/origin. Preserve raw artifacts and original backup files securely; they may contain confidential prices/contact details and are not encrypted. Nothing is uploaded, logged as full payloads, synchronized to cloud, or inserted into client quotation PDFs by this feature.

## Verification and limitations

`frontend/tests/backup-recovery.test.mjs` adds 20 tests: full/empty/single-section round trips, IDs/timestamps, catalog and profile/logo, historical versions and supplier snapshots, changed current prices, conflicts/merge/explicit replacement, invalid JSON/schema/fields/records, corruption/raw recovery, stale preview, staging/mid-write quota errors, rollback failure/retry, interrupted journal and normal writer blocking, legacy fallback, unrelated keys and byte/record limits. The audit's 900-offer long-URL reproduction passes; exact 16 MiB catalog and 32 MiB full-file boundaries are checked, as are UTF-8 Romanian characters and oversized exports. Existing PDF and backend pricing/quantity regressions are included in the full suites.

Native browser automation discovery returned `The browser access host is unavailable`. No screenshots, browser download persistence, native quota behavior, real cross-tab process interruption or full restored-project-to-quotation workflow was visually verified. Map-backed storage and component/static-render tests do not prove those native behaviors. Manual release check: in a clean isolated browser, create/save a project, suppliers and company profile, export, restore into another empty profile, reopen, compare historic prices/configuration, recalculate with FastAPI and export a quotation using existing PDF controls; verify amount/issuer. Then repeat with intentionally corrupted **test-only** storage, interrupted restore, blocked/full storage, stale tabs and 360/390/430 px/desktop layouts.
