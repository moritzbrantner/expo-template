# Baby Feeding

A private local-first log for baby feeds and pumping sessions, based on the paper workflow of writing down the time and bottle volume.

## MVP contract

- Record a feed with its time, amount in millilitres, and milk source: breast milk or formula.
- Record pumping/expression sessions separately so expressed volume is not confused with what the baby drank.
- Keep the most recent feed visible without turning the screen into a dashboard of counters.
- Show a chronological daily log and allow individual records to be deleted.
- Persist the log on-device with AsyncStorage; no account, cloud sync, analytics, or advertising is required.
- Treat the app as a recorder, not as medical advice or a feeding recommendation system.

## Run

```bash
bun install
bun run web
bun run typecheck
bun test
```
