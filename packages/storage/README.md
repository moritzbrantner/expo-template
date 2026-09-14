# @expo-template/storage

This package owns generic local persistence mechanics for the mobile-app workspace.

It deliberately does **not** own app schemas or domain migrations. Consumers provide a decoder (and, when needed, an encoder) so Tasks, Habits, and future apps remain authoritative for the shape and validity of their own state.

The key prefix plus an integer schema version produces keys such as `@expo-template/tasks/list-v1`. Existing JSON payload shapes are preserved. When a newer version is introduced, every migration step must be declared; missing, malformed, or throwing migrations fail closed to the consumer-provided fallback rather than partially applying or reviving stale data.
