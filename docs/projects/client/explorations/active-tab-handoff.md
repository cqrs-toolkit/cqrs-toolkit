# 13\. Exploration Notes

This section documents design alternatives under consideration that have not yet been committed to in the rest of the specification.

---

## 13.1 Active Tab Handoff for Non-SharedWorker Contexts

**Status:** Under evaluation

### 13.1.1 Problem statement

On platforms without SharedWorker support (Safari desktop, Firefox Android), the current specification enforces single-tab operation.
Users attempting to open a second tab are blocked with a modal indicating another tab is already open.

This provides correct behavior but poor user experience:

- Users may not remember which tab has the app open
- Users cannot have multiple views open simultaneously
- Accidentally opening a second tab requires manual resolution

### 13.1.2 Proposed alternative: Active tab handoff

Instead of blocking additional tabs, allow multiple tabs with **explicit handoff of database ownership** based on which tab is currently active (focused).

Core principles:

- Only the **active** (visible, focused) tab holds database write access
- Background tabs are **in-app suspended** — UI is frozen, no writes permitted
- When the user switches tabs, ownership transfers to the newly active tab
- If automatic handoff fails, the user manually resumes via a button

### 13.1.3 Handoff sequence

```
Tab A (active, owns DB)              Tab B (background, suspended)
        │                                      │
        │  [user switches to Tab B]            │
        ▼                                      │
visibilitychange: hidden                       │
        │                                      │
        ▼                                      │
suspendWrites()                                │
await pendingMutations()                       │
worker.closeDatabase()                         │
        │                                      │
        ▼                                      │
broadcast("db-released") ──────────────────────► receives "db-released"
        │                                      │
        │                                      ▼
        │                               visibilitychange: visible
        │                                      │
        │                                      ▼
        │                               worker.openDatabase()
        │                               reloadStateFromDB()
        │                                      │
        │                                      ▼
        │                               broadcast("db-acquired")
        │                                      │
[UI: "Session paused                    [UI: fully active]
 in this tab"]
```

### 13.1.4 Timeout and manual recovery

If the handoff does not complete within a configured timeout (e.g., 5 seconds for automatic, 60 seconds before forcing user action):

1. The newly active tab displays: **"Resuming session..."** with a spinner
2. After timeout, display: **"Resume Session"** button
3. User clicks button to force-claim database ownership
4. Previous tab (if still alive) receives force-claim notification and enters suspended state

```typescript
async function attemptHandoff(): Promise<HandoffResult> {
  // Wait for voluntary release from other tab
  const released = await Promise.race([
    waitForBroadcast('db-released'),
    delay(5000), // 5 second auto-handoff window
  ])

  if (released === 'timeout') {
    // Show "Resuming session..." and wait longer
    showResumingDialog()

    const manualWait = await Promise.race([
      waitForBroadcast('db-released'),
      delay(55000), // Additional 55 seconds
    ])

    if (manualWait === 'timeout') {
      // Show manual resume button
      return { status: 'requires-user-action' }
    }
  }

  return { status: 'success' }
}
```

### 13.1.5 Suspended tab behavior

A tab in suspended state:

- Displays an overlay indicating the session is active in another tab
- Disables all user interactions except navigation away
- Does not perform any database writes
- May optionally show a "Make this tab active" button

### 13.1.6 Known edge cases requiring resolution

1. **Tab closes during handoff** — Other tabs must detect via heartbeat timeout and allow claiming

2. **Rapid tab switching** — Need debouncing; switching A→B→A within 500ms should not trigger full handoff

3. **Split screen / multi-window on tablets** — Two tabs may be "visible" simultaneously; need tiebreaker (most recent focus event)

4. **Browser kills background tab** — Tab A loses focus, begins handoff, browser terminates it before broadcast completes; Tab B never receives release signal

5. **Network request in flight** — Mutation HTTP request sent, tab loses focus, response returns to suspended tab

6. **PWA vs browser mode** — Visibility semantics may differ

### 13.1.7 Implementation complexity assessment

| Component                     | Complexity | Notes                          |
| ----------------------------- | ---------- | ------------------------------ |
| BroadcastChannel coordination | Medium     | Message ordering, timeouts     |
| Pending mutation tracking     | Low        | Counter of in-flight ops       |
| Database open/close cycle     | Medium     | Clean shutdown, state reload   |
| UI suspend/resume states      | Medium     | Overlay, disabled interactions |
| Edge case handling            | High       | Many failure modes to handle   |

**Overall assessment:** High complexity with significant edge case surface area.
Recommend prototyping before committing to this approach.

### 13.1.8 Decision criteria

This approach should be adopted if:

- User research indicates single-tab blocking is a significant pain point
- Prototyping demonstrates acceptable reliability
- Edge cases can be handled without data corruption risk

This approach should be rejected if:

- Prototype reveals frequent handoff failures
- Complexity exceeds the UX benefit
- Alternative solutions (e.g., better single-tab UX) prove sufficient

### 13.1.9 Current status

The rest of this specification assumes **single-tab enforcement** for non-SharedWorker contexts.
If this exploration concludes favorably, Modes C and D in §0.1 will be updated to support active tab handoff as an alternative to tab blocking.
