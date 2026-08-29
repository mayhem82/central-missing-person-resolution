# Ingestion Run 009 - 2026-08-29

This run expands the system from the Suman test case into incident-wide source ingestion.

## Completed

- Registered both live DAO Makwanpur same-title publications as distinct source snapshots.
- Preserved the unresolved relationship between `document(6).pdf` and `document(7)(4).pdf` instead of guessing revision order.
- Registered Nepal Police missing and found datasets separately.
- Seeded five current Rasuwa-flood police missing records as immutable raw source records.
- Added EVID-025 through EVID-031.

## Guardrails applied

- No raw police record was automatically promoted to a canonical person.
- No missing-list persistence was treated as proof that a person remains missing.
- No absence from indexed search was treated as absence from the police database.
- No inference was made that either DAO PDF supersedes the other.

## Open technical gap

The two DAO PDFs still require direct binary retrieval and row-by-row extraction before a reliable whole-list diff can be generated. That task remains open and must not be simulated from metadata.

## Next ingestion targets

1. Obtain both DAO PDF binaries and preserve hashes.
2. Extract every row from each snapshot.
3. Generate deterministic row-level diff.
4. Expand Nepal Police Rasuwa cohort beyond the first indexed records.
5. Interrogate and ingest `found` records independently.
6. Reconcile duplicate names and status conflicts without auto-merge.
