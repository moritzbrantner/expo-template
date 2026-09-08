# Gift Tracker

A private local-first Expo app for remembering gifts across relationships.

## First-slice contract

- keep a small local list of people
- record gifts as received, given, or planned
- store title, date, occasion, and notes on-device
- show upcoming planned gifts in deterministic date order
- let a planned gift explicitly reference a gift that was previously received
- warn when that linked gift would be given back to its original giver
- publish a web preview through the existing Expo portfolio

## Boundary

This slice intentionally has no account, backend, contacts permission, camera permission, notification permission, shopping feed, or inferred social graph. A later slice may add local reminders or contact-assisted entry, but those should be separate device-acceptance work.

The authoritative regift protection is explicit provenance (`sourceGiftId`), not fuzzy text similarity. Similarity can become an advisory helper later without silently rewriting gift history.
