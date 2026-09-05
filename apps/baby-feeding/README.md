# Baby Feeding

A private local-first log for baby feeds and pumping sessions, based on the paper workflow of writing down the time and bottle volume.

## MVP contract

- Record a feed with its time, amount in millilitres, and milk source: breast milk or formula.
- Make common recording operations tap-first: adjust millilitres with +/- buttons, adjust time by +/-5 minutes or +/-1 hour, and adjust the date without opening the keyboard.
- Open a dedicated calendar/time selector only when the displayed date or time is tapped directly.
- Record pumping/expression sessions separately so expressed volume is not confused with what the baby drank.
- Mark whether a feed used a bottle and derive the current dirty-bottle count from bottle-used feeds since the latest cleaning event.
- Record bottle cleaning and sterilization as timestamped log events, including whether sterilization has been recorded since the latest cleaning.
- Share a point-in-time snapshot by encoding the complete feeding and bottle-care state into a versioned URL query parameter.
- Let a fresh recipient import a shared snapshot automatically; if the recipient already has local records, require an explicit replace-or-keep choice.
- Keep the share URL serverless: no account, sync service, or database is required for transfer.
- Keep the most recent feed visible without turning the screen into a dashboard of decorative counters.
- Show a chronological daily log and allow individual records to be deleted.
- Persist the log on-device with AsyncStorage; no account, cloud sync, analytics, or advertising is required.
- Treat the app as a recorder, not as medical advice, a feeding recommendation system, or a hard-coded sterilization schedule.

## Share-link privacy boundary

The shared snapshot is encoded, not encrypted. Anyone with the URL can read the records contained in that snapshot, and the URL may remain in browser or messaging history. Sharing is a point-in-time transfer only; later changes on either device do not synchronize automatically.

## Run

```bash
bun install
bun run web
bun run typecheck
bun test
```
