# Architecture

The system has five layers:

1. Source snapshots — immutable captures of what a publisher stated.
2. Raw person records — one record per published row/report/notice.
3. Identity claims — explicit assertions linking a raw record to a working person cluster.
4. Status events — append-only temporal facts about contact, rescue, hospitalisation or death.
5. Derived current views — computed from the evidence above; never destructive.

## Identity classifications

`CONFIRMED_MATCH`, `PROBABLE_MATCH`, `POSSIBLE_MATCH`, `CONFLICTING_MATCH`, `EXCLUDED`, `UNKNOWN`.

A `CONFIRMED_MATCH` requires a hard bridge such as a verified photograph, unique government identifier, official correction, family confirmation, or similarly discriminating evidence. Name-only similarity is prohibited as confirmation.

## Status values

`OUT_OF_CONTACT`, `MISSING_OFFICIALLY_RECORDED`, `LOCATED`, `RECONTACTED`, `RESCUED`, `HOSPITALISED`, `INJURED`, `DECEASED`, `STATUS_UNKNOWN`.

A later status event does not erase an earlier one.

## Conflict model

Conflicts are first-class records. Examples include same name with different age, same phone with different name, same vehicle with multiple people, family report conflicting with government record, police status conflicting with district administration status, or a person appearing in missing and rescued datasets simultaneously.

The engine proposes conflicts. A human resolves them.
