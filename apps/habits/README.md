# Habits

A local-first habit tracker focused on simple check-ins rather than engagement mechanics.

## MVP contract

- Add a named habit with a weekly target of 3, 5, or 7 days.
- Mark or unmark the current day.
- See the previous seven days and progress against the weekly target.
- Remove habits and keep the full record on-device with AsyncStorage.
- No streak scoring, social feed, account, reminders, or cloud sync in this first slice.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
