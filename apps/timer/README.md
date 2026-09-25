# Timer & Stopwatch

A quick timer and stopwatch that derives elapsed time from timestamps instead of assuming JavaScript interval ticks are reliable.

## MVP contract

- Choose 1, 5, 10, or 25 minute timer presets.
- Start, pause, and reset the timer.
- Start, pause, and reset a stopwatch with tenths-of-a-second display.
- Persist active timer and stopwatch timestamps locally so reopening can recover the correct elapsed state.
- Require no account, network connection, analytics, or engagement loop.

The MVP does not schedule local notifications, exact alarms, or background execution. It keeps time correctly after suspension/reopen, but it does not claim to alert while the app is unavailable.

## Local checks

```sh
bun run test
bun run typecheck
bun run build
```
