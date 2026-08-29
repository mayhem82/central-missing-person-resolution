# Handover

This repository is intentionally transferable.

A receiving organisation may fork, rename, restructure, extend, automate, replace components, or move the system to another platform. It does not need knowledge of MAYHEM or DFAPTI terminology to operate.

What should remain explicit:
- provenance for every factual claim;
- immutable raw source records;
- append-only status history;
- explicit identity claims;
- no silent merges;
- human review before consequential identity/death determinations;
- public/private data separation.

## Starting a new incident

1. Copy `incidents/nepal-rasuwa-2026/` to a new incident directory.
2. Replace `incident.json`.
3. Add source snapshots and raw records.
4. Create canonical persons only when needed to cluster records.
5. Link records using explicit identity claims.
6. Add temporal status events.
7. Run validation.
8. Review conflicts before publishing any current-status view.

The receiving operator owns its deployment and may evolve the architecture as required.
