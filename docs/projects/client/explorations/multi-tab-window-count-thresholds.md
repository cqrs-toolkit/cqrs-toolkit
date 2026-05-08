# Multi-tab window count thresholds

## Context

In multi-tab mode (Mode C, SharedWorker), the library tracks the active window count and may emit `TooManyWindowsOpen` or block new operations once the count exceeds a configured limit. The exact threshold is intentionally configurable and environment-dependent.

Surfaced from the previous open-ambiguities section.

## Open considerations

The spec defines the **failure modes** (warn the user, block operations, etc.) but not exact limits. Real applications will need to pick thresholds based on:

- Per-window memory cost (cache key holds, in-flight subscriptions, RxJS subscription chains)
- Per-tab WebSocket overhead (only one WS per origin, but coordination cost scales)
- User-experience considerations (when does "you have too many tabs open" actually surface to the user?)

## Status

Open. Configuration decision per consumer / deployment. The library exposes the failure-mode events; the threshold itself is a runtime config knob, not a spec constant.
