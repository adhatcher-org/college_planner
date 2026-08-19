# Resolved: `react-hooks/set-state-in-effect`

## Status

Resolved on 2026-08-14 by commit `40c2cc3` ("Fix React effect state updates"), merged to `main` in PR #46.
This document is kept as a record of the remediation; no work remains.

## Objective

Eliminate the five `react-hooks/set-state-in-effect` findings reported for
`frontend/src/main.tsx` without suppressing the rule or changing the planner's visible behavior.
The affected behavior was planner initialization, child selection, registry refresh, and description
filter debouncing.

## Verification

`react-hooks/set-state-in-effect` is still enabled at error severity — it comes in through
`reactHooks.configs.recommended.rules` in `frontend/eslint.config.js` with
`eslint-plugin-react-hooks` v7. `npm run lint` from `frontend/` reports no violations, and
`frontend/src/main.tsx` contains no `eslint-disable` comments of any kind.

## Constraints that were honored

- `react-hooks/set-state-in-effect` remains enabled. No file-level, effect-level, or global
  disablement was added.
- Behavior was not replaced with delayed state setters solely to silence lint.
- Request cancellation and stale-response protection in the registry fetch path were preserved.
- The UX contracts were preserved: default child selection, initial planner load, debounced
  description search, clearing transient status after a successful registry load, and error messages
  for failed loads.

## What was actually done

1. Derived child selection instead of storing it. `PlannerApp` computes
   `const selected = children.find((child) => child.id === selectedId) ?? children[0]` during render.
   The invalid-selection fallback moved into the `loadChildren` data-loading path as a functional
   `setSelectedId` update, so no effect exists whose sole job is normalizing the selection.

2. Isolated asynchronous loading behind request functions. `loadUser`, `loadChildren`, and
   `loadRegistry` are `useCallback` request functions. The initialization and registry effects only
   start a request and cancel it on unmount, using a local `active` flag so a late failure cannot set
   state after unmount. `AbortController` (`registryAbortRef`) and the `registryRequestRef` request
   counter were kept, so an earlier response cannot overwrite a later filter change.

3. Removed synchronous state resets from effects by remounting instead. `SchedulePanel` and
   `RegistryTable` are now remounted through `key` props derived from the selected account, college
   dates, and the active registry filters, which replaces the effects that previously reset form,
   editing, and collapse state when a dependency changed. `RegistryTable` is a thin wrapper that
   applies `collapseResetKey` as the `key` for `RegistryTableContent`.

4. Removed the `AccountSettings` mirroring effect that copied `user` props into form state. The
   profile and email forms are seeded from props on mount and re-seeded from the value returned by
   `onUserChanged()` after a successful save.

5. Cleared transient status as part of successful request completion (`setStatus("")` at the end of
   the successful `loadRegistry` path) rather than from a separate reset effect.

The debounced description input still uses a single `useEffect` with a `window.setTimeout` and a
`clearTimeout` cleanup writing to `debouncedDescription`. The rule does not flag it because the write
is timer-deferred rather than synchronous, and the registry query keys off `debouncedDescription`, so
only the settled value is requested.

## Test coverage

`frontend/src/main.test.tsx` covers the behavior this refactor touched:

- initial user/child/registry loading with oldest dates first;
- description debounce, asserting only the settled query is sent;
- setting and clearing the display start date without changing the summary request;
- stale registry responses being ignored after a newer request;
- graceful fallback when the balance-adjustments lookup fails;
- `AccountSettings` profile, email, and password updates re-seeding from the reloaded user.
