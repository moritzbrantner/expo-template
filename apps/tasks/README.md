# Tasks

A calm, local-first to-do list for capturing work, completing it, and leaving the app.

## MVP contract

- Add a task with one short text field.
- Mark tasks complete or reopen them.
- Filter by open, all, or completed tasks.
- Delete individual tasks or clear all completed tasks.
- Persist the task list on-device with AsyncStorage.
- Keep the core task transitions deterministic and unit-tested.

## Boundaries

This first slice has no account, sync, due dates, reminders, projects, priorities, streaks, or engagement mechanics. Those capabilities should be added only when a concrete product need justifies them.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
