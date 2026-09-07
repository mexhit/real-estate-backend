# Manually-triggered job runs are indistinguishable from scheduled runs

The Area Price Snapshot pricing job can now be triggered manually via `POST /jobs/area-price-snapshot/run`, in addition to its weekly cron schedule. A manual run executes the exact same logic and writes the exact same kind of Area Price Snapshot row as a scheduled run — there is no flag or field distinguishing how a given Snapshot was produced. This means triggering a manual run (e.g. to test the job) will overwrite the Area's displayed "most recent" price and add an entry to its Snapshot history, indistinguishable from a real Sunday run. This was a deliberate simplicity trade-off over adding a "trigger source" field, made because the only user triggering runs manually is also the only consumer of the Area's displayed price at this stage.

## Consequences

A future reader who notices Area Price Snapshot rows with timestamps that don't fall on the weekly schedule should not treat this as a bug — it means the job was triggered manually. If manual triggering is later opened up to more users, or if test runs need to stop polluting production Areas' displayed prices, this will need revisiting (e.g. a `source` field, or a way to run without persisting).
