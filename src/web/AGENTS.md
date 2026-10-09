# AGENTS.md

Guidance for AI coding agents working on the JCC web code in `src/web`. It adds to any `AGENTS.md` at the repository root.

## Architecture

- Keep the boundaries set by the JCC refactor, even when a violation would work. Flag violations in reviews.
- OpenLayers modules don't import React or context. `Map.tsx` is the bridge between them.
- `data/` holds only the data model. Derived or algorithmic code, such as routing, lives in `utils/` and takes its data as parameters instead of reading the global singletons. Dependencies run one way; `utils/constants.ts` is the exception, since it holds only constants. Only handlers connect the layers.
- No business logic in `JaiaDispatch` or the reducer. Logic belongs in the handlers and the layers below them.
- Bot status updates arrive twice a second. Never tie expensive work, such as routing, to them.

## Code structure

- No dead handlers: every handler is reachable from a dispatched action. A handler reached only from tests means something was deleted by mistake, or the handler should go.
- Nothing public that doesn't need to be. Public API with no caller yet is fine when a later step of the same work uses it, but not at the end of the work.
- Component folders mirror the UI: a component lives in the folder of the panel or component that contains it on screen.
- Use `let` and `const`. `jdv/` is older code that still uses `var`; don't copy its style or convert it.

## Intentional choices

Don't flag these or propose changing them:

- Optional fields on `JaiaAction` are an accepted tradeoff of having one action type. Don't propose per-action union types.
- `utils/jaia-api.ts` mirrors the server's endpoints, not what the JCC currently calls. Never remove a method because nothing uses it; only when the server endpoint is removed or changed.
- The editor reports TS2721 ("possibly null") on `jaiaDispatch(...)` calls. The project's `tsc` doesn't, and every call site has the same pattern, so don't add guards.

## Data and storage

- Changing a saved file format means bumping its version and adding a migration. A version the JCC doesn't know is refused as an unknown format.
- Zone-set save, export, load and snapshot code stays in step with the mission-set code. Change both, or say why they differ.
- A constant that mirrors a DCCL bound gets a comment naming the proto field it comes from, as `MAX_LANES_PER_BOT` and `MAX_SEGMENTS` in `utils/constants.ts` do.
- Undo restores data, never interaction. Keep dialog and confirmation state out of undo snapshots, so an undo never reopens a dialog.

## Operators

- Operators use Android tablets, iPads, Windows tablets running Chrome, and Safari on Macs. Don't propose fixes that only make sense on desktop Chrome, and don't rely on hover: most operators use touch.
- Waypoints and zone vertices are only added at the end, never inserted between existing ones, because hitting a gap between points on a tablet is unreliable. Moving and deleting still happen anywhere. If an appended point makes bad geometry, accept or reject the edit; don't move where it lands.

## Tests

- A bug fix comes with a regression test. Run it against the old code to show it fails, then against the fix.
- A test asserts its setup before the behaviour under test (for example, that the route really crosses the zone) and avoids geometric ties, so a pass means the code works.
- Component tests stub `JaiaContext` rather than mounting `JaiaContextProvider`, which starts as `null` and opens a polling interval.
