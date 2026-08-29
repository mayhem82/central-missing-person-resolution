# Privacy and Safety

Principles:
- data minimisation;
- purpose limitation;
- provenance;
- no speculative identification;
- no facial-identification automation by default;
- no automatic deceased-person matching;
- no public exposure of unnecessary private contact details;
- no automatic family notification;
- human review for consequential status changes.

The investigator dataset may contain contact details when directly relevant to identity resolution. Public views must redact such details unless an authorised operator explicitly approves disclosure.

## Publication and consent controls

Public publication is a separate decision from evidence retention. A record can remain in the immutable evidence trail while its public visibility is restricted or withdrawn.

The default public state is `PUBLIC_MINIMISED`. Public output is limited to fields necessary for humanitarian tracing and incident reconciliation. Phone numbers, email addresses, exact home addresses, government identifiers, medical detail and family contact information are withheld by default.

`PUBLIC_WITH_CONSENT` may expose specifically approved contact information or photographs only when a consent basis, consent timestamp and approving human operator are recorded. `RESTRICTED_INVESTIGATOR` and `WITHHELD` records are excluded from public interoperability exports.

A source having already published personal information does not automatically authorise republication of every field. Publication must remain tied to a defined humanitarian purpose and the minimum information needed for that purpose.

Withdrawal or correction requests change publication and access state rather than deleting source evidence. This preserves the audit trail while reducing further dissemination.

The machine-readable policy is `data/publication-policy.json`.

## Interoperability

The system can generate a privacy-preserving PFIF 1.4 interoperability export from the current public dataset. PFIF export is a projection of source claims only. It does not merge identities, create canonical-person determinations, infer death, or bypass human review.
