# Build spec — "Carousel": a deterministic tick-simulation engine (single self-contained `index.html`)

Build a small **deterministic simulation engine** as a single self-contained `index.html` (zero
dependencies, fully offline — no CDN, no network, no external files). All simulation state is
**integer-only** (no floats). The page must expose a global `window.ENGINE` API that a headless driver
can call. A minimal visible page is fine; the engine is the deliverable, not the visuals.

## The public API (exact — a driver depends on it)

```
window.ENGINE = {
  createWorld(seed, config) -> world     // fresh world; integer `seed` drives all randomness
  step(world)               -> void      // advance the simulation exactly one tick
  applyCommand(world, cmd)  -> void       // apply a player command (see below)
  snapshot(world)           -> string     // serialize the ENTIRE world to a string
  restore(string)           -> world      // rebuild a world from a snapshot string
  hashState(world)          -> string     // stable fingerprint of the world's full state
  drainEventLog(world)      -> array       // events since the previous drain, then clears them
  report(world)             -> { tick, unitCount, totalResources, minted, burned }   // status/telemetry
}
```

### Event object schema (exact — a driver reads these fields)

Every event emitted to the log is an object with **at least** these fields (extra fields are fine):

```
{ seq: <int>,      // strictly increasing, unique across the whole run
  type: <string>,  // one of: "spawn" | "mint" | "burn" | "hit" | "dead"
  amount: <int> }  // resources created (for "mint") or destroyed (for "burn"); 0 for others
```

`report().minted` / `report().burned` are the cumulative totals of all `mint` / `burn` `amount`s emitted
so far (so `report().totalResources === report().minted - report().burned` must always hold).

## The world (mandate these mechanics so the engine is non-trivial; exact numbers are yours)

- A ring of **S stations** (S ≥ 4), each holding an **integer stockpile** (≥ 0, capped at some `CAP`).
- **Units** spawn periodically at station 0 (up to a `MAX_UNITS` cap), each with an integer `hp` and an
  integer `cargo`. Units are kept ordered by ascending `id`.
- Each `step(world)` advances exactly one tick and applies these systems **in a fixed documented order**:
  1. **spawn** a new unit on the spawn cadence (if under `MAX_UNITS`);
  2. **produce** at each station (add integer output, capped at `CAP`) — any per-station variability
     (e.g. a cooldown) **must** come from the seeded PRNG below, never from `Math.random`;
  3. **move** every unit one station along the ring, in id order;
  4. **transfer** — units pick up from / drop to the station they are on, by integer rules;
  5. **interact** — units sharing a station take deterministic combat damage;
  6. **cleanup** — remove dead units (`hp ≤ 0`).
- **Commands** (`applyCommand`): at least `setProd` (change a station's production), `inject` (add
  resources to a station), and `kill` (remove a unit by id). Every command carries a unique `id`.
- **Events**: emit events for meaningful changes — at least `spawn`, `mint` (resources created),
  `burn` (resources destroyed), `hit`, `dead`. Every event carries a strictly increasing integer `seq`.

## Randomness (so the engine is well-defined and reproducible)

Use this exact PRNG for **all** randomness (do not use `Math.random`, `Date`, or any external entropy):

```
rngState_next = (rngState * 1103515245 + 12345) & 0x7fffffff      // 31-bit LCG
```

Seed `rngState` from `createWorld`'s `seed`. Every random choice must advance this state.

## Correctness requirements (the engine must satisfy ALL of these)

1. **Determinism.** Given the same `seed` and the same sequence of `step`/`applyCommand` calls, the engine
   must produce **identical** state and **identical** events on every run. (Implied: no `Math.random`, no
   reliance on unstable iteration order or wall-clock time.)
2. **Exact save/load.** `restore(snapshot(world))` must reproduce the world such that it behaves
   **identically** going forward — `snapshot` must capture the **entire** state (including the PRNG state,
   any cooldowns/counters, the event-id counter, and applied-command bookkeeping), and `hashState` of a
   restored world must equal `hashState` of the original at that point.
3. **Idempotent commands.** Applying a command whose `id` was already applied is a **no-op** (the state
   must not change). Track applied command ids.
4. **Resource conservation.** `report(world).totalResources` (the sum of every station stockpile + every
   unit's cargo) must, at every tick, exactly equal **(sum of all `mint` event `amount`s − sum of all
   `burn` event `amount`s)** emitted so far (which is also `report().minted - report().burned`). Whenever
   resources are created, emit a `mint` event whose `amount` is the exact integer quantity created; whenever
   they are destroyed (e.g. overflow past `CAP`, or a dead unit's cargo), emit a `burn` event whose `amount`
   is the exact quantity destroyed. The event ledger and the actual on-board total must never diverge.
5. **Monotonic events.** Every emitted event's `seq` is a **strictly increasing**, **unique** integer
   across the whole run.

## Quality rubric (build it well)

- Clean, readable, self-contained code; clear module boundaries inside the one file (lexing of commands,
  the per-system step pipeline, the data model, serialization).
- Robust to odd input: out-of-range stations, negative amounts, commands targeting nonexistent units,
  unknown command types — handle them gracefully (clamp/ignore), never throw, never hang.
- Integer-only state; no floats anywhere in the simulation.

The entry file **must** be `index.html`, self-contained and offline.
