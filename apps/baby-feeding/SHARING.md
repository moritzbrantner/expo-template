# Sharing contract

Baby Feeding can transfer its complete local log without a backend by encoding a versioned, compact snapshot into the `state` query parameter of the public GitHub Pages app URL.

- The shared link is a point-in-time snapshot, not live synchronization.
- A recipient with no local records imports the snapshot automatically.
- A recipient with existing local records must explicitly replace them or keep them.
- Invalid or unsupported snapshots never overwrite local data.
- Snapshot payloads are encoded but not encrypted; possession of the link grants access to the embedded records.
- The link contains no server identifier, account token, or cloud-storage reference.
