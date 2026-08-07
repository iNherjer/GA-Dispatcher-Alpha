# PA24 Comanche Door Logic

This note documents the current A2A PA24 / Comanche door behavior in
`ga-tracker-client/tracker.js`. It exists because the aircraft door uses
custom LVars with non-generic polarity, and generic door-position writes can
make the visual door appear inverted.

Last checked against tracker `v276`.

## Entry Points

All user-aircraft door operations should go through:

- `setUserAircraftDoor(true, doorIndex, reason, doorProfile)` to open.
- `setUserAircraftDoor(false, doorIndex, reason, doorProfile)` to close.
- `startUserAircraftDoorOpenHold(...)` only while a boarding/deboarding/manual
  passenger action is running.

PA24 profiles are:

- `pa24_comanche`
- `pa24`
- `comanche`

The current callers that intentionally open immediately and close at the end:

- `mission_scene_boarding`
- `mission_scene_deboarding`
- `mission_scene_manual_pax` for manual passenger load/unload

Manual passenger load/unload opens before removing/spawning the passenger,
starts a short hold, waits the configured open/close delays, then closes.

## Diagnostic Tool

Tracker `v272+` includes a small manual test path for this aircraft:

- Browser console: `pa24DoorDebug.open()`
- Direct LVar write: `pa24DoorDebug.setVar('L:Door1Handle', 1, 'Bool')`
- Direct latch/input event: `pa24DoorDebug.inputEvent()`

The panel sends exactly one command at a time and returns an ACK. Use it while
watching the aircraft visually in MSFS. This is the preferred way to change the
PA24 hardcoded values: first test a single variable/value/unit, then update the
real boarding/deboarding logic after the visual effect is known.

## PA24 Open

For PA24 open, the current exact LVar sequence is:

```js
await pa24DoorDebug.setVar('L:Door1Latch', 0, 'number');
await new Promise(r => setTimeout(r, 900));
await pa24DoorDebug.setVar('L:Door1Handle', 1, 'Bool');
```

Observed/expected effects:

- Unlock latch: `Door1Latch = 0`
- Wait about `900ms`.
- Open handle/door command: `Door1Handle = 1`
- Do not write `DoorOpen*`, `CabinDoorOpen*`, or `ExitOpen*` while opening.

Reason: writing the generic open-position vars during PA24 open caused the
visual door behavior to fight the real handle/latch path and made the door look
inverted or close again.

## PA24 Close

For PA24 close, the current exact LVar sequence is:

```js
await pa24DoorDebug.setVar('L:Door1Handle', 0, 'Bool');
await new Promise(r => setTimeout(r, 3000));
await pa24DoorDebug.setVar('L:Door1Latch', 1, 'number');
```

Observed/expected effects:

- Close handle/door command: `Door1Handle = 0`
- Wait about `3000ms` before locking.
- Lock latch: `Door1Latch = 1`

Close does not write generic position vars either. For PA24, automatic door
control is intentionally limited to the explicit latch and handle LVars.

## Open Hold

The hold is only to prevent the PA24 door from falling shut during boarding or
manual passenger actions.

For PA24 hold, keep:

```js
await pa24DoorDebug.setVar('L:Door1Handle', 1, 'Bool');
```

Important effects:

- Reasserts only `Door1Handle = 1`.
- Does not spam latch writes.
- Does not write generic open-position vars.

## LVar Candidate Names

The automatic PA24 path uses exact middle-index LVar names:

- `L:Door1Handle`
- `L:Door1Latch`

Do not route the automatic PA24 path through broad candidate names unless a new
manual test proves the exact names stopped working. Broad candidates make it too
easy to hit `Door2*`, `Exit*`, or generic position vars and reintroduce inverted
visual behavior.

## Behavior/Input Events

The diagnostic panel can still test the behavior latch input event manually:

- `LEVER_door_latch_2States_Toggle`
- `B:LEVER_door_latch_2States_Toggle`

Do not use this event in the automatic PA24 boarding/deboarding/manual-pax door
flow. It behaves like a toggle, so it can flip an already-correct latch state.
The automatic path must use only the explicit LVars above.

Legacy PA24 custom client events are disabled for automatic door control:

- Open fallback label: `PA24-door_latch_unlock`
- Close fallback label: `PA24-door_latch_lock`

If either label appears in the tracker console during PA24 boarding/deboarding,
the automatic path is no longer the documented safe path.

## Known Traps

- Do not change PA24 open to `writeOpenPosition: true`.
- Do not change handle values from guesses. The current proven automatic
  sequence is `Door1Handle = 1` after unlock to open and `Door1Handle = 0`
  before locking to close.
- Do not invert latch values. PA24 unlock is `Door1Latch = 0`, lock is
  `Door1Latch = 1`.
- Do not call `setA2aDoorByLVars(..., 'pa24_comanche')` for automatic PA24 door
  control. Use the exact `L:Door1Latch` / `L:Door1Handle` sequence.
- Do not let generic door events run after a PA24-specific path succeeded.
  They can fight the custom LVar/event logic.
- Do not fall back to standard aircraft door events for `pa24_comanche`, even
  if an LVar write reports failure.
- Do not send PA24 latch toggle/client events during automatic boarding,
  deboarding, or manual passenger load/unload. Explicit LVars are the source of
  truth.
- If `tracker.js` changes, bump `TRACKER_VERSION` and `TRACKER_VERSION_CODE`,
  rebuild the tracker EXE, and upload the release asset according to
  `docs/github-push-workflow.md`. Only raise the web minimum in `sync.js` when
  the existing Web/Relay contract actually requires the new tracker version.

## Expected Debug Signatures

Current implementation open signature:

```text
DOOR_PA24_OPEN_START ...
PA24_DOOR_EXACT_OPEN_START ... openHandleDelayMs=900 ... handleOpen=1 handleClose=0 latchUnlock=0 latchLock=1 ...
A2A_VAR_SET name=L:Door1Latch ... value=0 ... latch-unlock
A2A_VAR_SET name=L:Door1Handle ... value=1 ... handle-open
DOOR_PA24_OPEN_DONE ... inputLatchOk=0 eventOk=0 lvarOk=1 ...
```

Current implementation hold signature:

```text
PA24_DOOR_EXACT_HOLD_START ... handleOpen=1 ...
A2A_VAR_SET name=L:Door1Handle ... value=1 ... handle-open
```

Current implementation close signature:

```text
DOOR_PA24_CLOSE_START ...
PA24_DOOR_EXACT_CLOSE_START ... closeLatchDelayMs=3000 ... handleOpen=1 handleClose=0 latchUnlock=0 latchLock=1 ...
A2A_VAR_SET name=L:Door1Handle ... value=0 ... handle-close
A2A_VAR_SET name=L:Door1Latch ... value=1 ... latch-lock
DOOR_PA24_CLOSE_DONE ... inputLatchOk=0 eventOk=0 lvarOk=1 ...
```
