# Baby Feeding

A private local-first log for direct breastfeeding, bottle feeds, and pumping sessions.

## MVP contract

- Keep feeding-method configuration in Settings, opened from the top-right gear.
- Let users enable Breast milk, Pumping, Formula, or any non-empty combination; use those choices only to control which recording tools are visible.
- Let users choose whether recording buttons show icons, text, or icons plus text; keep older preferences compatible by defaulting to icons plus text.
- Keep the chronological history above the Add record composer so the primary recorder sits at the bottom of the screen/content and is easier to reach with a thumb.
- Keep Breastfeeding, Bottle, and Pumping selectors on one row and keep the Bottle used toggle compact.
- Record direct breastfeeding as its own feeding event without inventing a millilitre amount.
- Record a bottle feed with its time, amount in millilitres, and milk source: breast milk or formula.
- Make common recording operations tap-first: adjust millilitres with +/- buttons, adjust time by +/-5 minutes or +/-1 hour, and adjust the date without opening the keyboard.
- Open a dedicated calendar/time selector only when the displayed date or time is tapped directly.
- Record pumping/expression sessions separately so expressed volume is not confused with what the baby drank.
- Keep dedicated Bottles and Pumping gear pages, available when the corresponding feeding methods are enabled, for tracking individual equipment as dirty, washed, or sterilized.
- Keep historical bottle-care log entries readable for compatibility even though ongoing equipment care lives on the dedicated care pages.
- Keep project-explanation copy off the main recording screen; the primary workflow should be self-explanatory.
- Provide a dedicated Stats page for the last seven days with measured intake split by breast milk/formula, pumped volume, and direct-breastfeeding session counts without inventing volume.
- Share a point-in-time snapshot by encoding the complete feeding log into a versioned URL query parameter.
- Let a fresh recipient import a shared snapshot automatically; if the recipient already has local records, require an explicit replace-or-keep choice.
- Keep the share URL serverless: no account, sync service, or database is required for transfer.
- Keep the most recent feeding event visible without turning the main screen into a dashboard of decorative counters.
- Show a chronological daily log and allow individual records to be deleted.
- Persist the log, settings, and equipment state on-device with AsyncStorage; no account, cloud sync, analytics, or advertising is required.
- Treat the app as a recorder, not as medical advice, a feeding recommendation system, or a hard-coded sterilization schedule.

## Share-link privacy boundary

The shared snapshot is encoded, not encrypted. Anyone with the URL can read the records contained in that snapshot, and the URL may remain in browser or messaging history. Sharing is a point-in-time transfer only; later changes on either device do not synchronize automatically.

Share payload version 2 adds direct-breastfeeding events while continuing to accept version-1 links created before that record type existed. Equipment state is device-local and is not included in the feeding-log share snapshot.

## Run

```bash
bun install
bun run web
bun run typecheck
bun test
```
