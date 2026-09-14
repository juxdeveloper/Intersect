# Intersect — Agent Instructions

Welcome to the Intersect repository. Each phase of this project is developed in a fresh agent conversation.

## Core Directives for Future Agents

1. **Read Before Editing**:
   - Always read `MASTER.md` and the prompt for your assigned phase before making changes.
   - Reconcile repository reality with the master document. Do not overwrite existing implementation or newer user decisions with stale seed statuses.

2. **Respect the Version Gate**:
   - Implement only the authorized phase and any required repairs to its prerequisites.
   - Do not advance to the next phase without explicit authorization. Completing one phase is not authorization to begin the next.

3. **Durable Handoff Update**:
   - At the completion of your authorized phase, update `MASTER.md` in place with factual completion records: files changed, commands run and actual outcomes, limitations, blockers, and next authorized phase.
   - Record only verified facts; never mark a phase complete based on code written without running verification.

4. **Zero Remote Dependencies / Static Architecture**:
   - All runtime computation, rendering, and data persistence run purely locally in the user's browser.
   - No external CDNs, hosted solver backends, telemetry, or remote API requests.
