# PA24 Comanche Door Logic

This note documents the current A2A PA24 / Comanche door behavior in
`ga-tracker-client/tracker.js`. It exists because the aircraft door uses
custom LVars with non-generic polarity, and generic door-position writes can
make the visual door appear inverted.

Last checked against tracker `v273`.

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
- Direct LVar write: `pa24DoorDebug.setVar('L:Door1Handle', 0, 'Bool')`
- Direct latch/input event: `pa24DoorDebug.inputEvent()`

The panel sends exactly one command at a time and returns an ACK. Use it while
watching the aircraft visually in MSFS. This is the preferred way to change the
PA24 hardcoded values: first test a single variable/value/unit, then update the
real boarding/deboarding logic after the visual effect is known.

## PA24 Open

For PA24 open, the current LVar fallback is:

```js
setA2aDoorByLVars(true, doorIndex, reason, 'pa24_comanche', {
  writeOpenPosition: false,
  writeLatch: true,
  handleOpenValue: 0,
  handleCloseValue: 1,
  latchUnlockValue: 0,
  latchLockValue: 1
});
```

Observed/expected effects:

- Unlock latch: `Door1Latch = 0`
- Open handle: `Door1Handle = 0`
- Do not write `DoorOpen*`, `CabinDoorOpen*`, or `ExitOpen*` while opening.

Reason: writing the generic open-position vars during PA24 open caused the
visual door behavior to fight the real handle/latch path and made the door look
inverted or close again.

## PA24 Close

For PA24 close, the current LVar fallback is:

```js
setA2aDoorByLVars(false, doorIndex, reason, 'pa24_comanche', {
  writeOpenPosition: true,
  writeLatch: true,
  handleOpenValue: 0,
  handleCloseValue: 1,
  latchUnlockValue: 0,
  latchLockValue: 1
});
```

Observed/expected effects:

- Close handle: `Door1Handle = 1`
- Close generic position vars: `DoorOpen* = 0`, `CabinDoorOpen* = 0`,
  `ExitOpen* = 0`
- Lock latch: `Door1Latch = 1`

Close may write the position vars to zero. The problematic case was writing
position vars to open while opening.

## Open Hold

The hold is only to prevent the PA24 door from falling shut during boarding or
manual passenger actions.

For PA24 hold, keep:

```js
setA2aDoorByLVars(true, idx, reason, 'pa24_comanche', {
  writeOpenPosition: false,
  writeLatch: false,
  handleOpenValue: 0,
  handleCloseValue: 1,
  latchUnlockValue: 0,
  latchLockValue: 1
});
```

Important effects:

- Reasserts only `Door1Handle = 0`.
- Does not spam latch writes.
- Does not write generic open-position vars.

## LVar Candidate Names

The PA24 uses middle-index names in practice. Keep these candidate variants:

- `Door1Handle`
- `Door1Latch`
- `Exit1Open`

The helper also tries prefixed variants such as `L:`, `L:1:`, and `Z:`, and
falls back to index `2` for door index `1`.

## Behavior/Input Events

The code first tries the behavior latch input event:

- `LEVER_door_latch_2States_Toggle`
- `B:LEVER_door_latch_2States_Toggle`

In observed logs this often returned `INPUT_EVENT_HASH_MISSING`, so the code
must not rely on it. The deterministic LVar fallback above is the important
path.

Legacy PA24 custom client events are only fallback/compatibility:

- Open fallback label: `PA24-door_latch_unlock`
- Close fallback label: `PA24-door_latch_lock`

## Known Traps

- Do not change PA24 open to `writeOpenPosition: true`.
- Do not change handle values from guesses. PA24 measured handle polarity is
  `Door1Handle = 0` open and `Door1Handle = 1` closed.
- Do not invert latch values. PA24 unlock is `Door1Latch = 0`, lock is
  `Door1Latch = 1`.
- Do not call `setA2aDoorByLVars(..., 'pa24_comanche')` for latch control
  without explicitly passing `latchUnlockValue: 0` and `latchLockValue: 1`.
  The generic defaults are not the documented PA24-safe values.
- Do not let generic door events run after a PA24-specific path succeeded.
  They can fight the custom LVar/event logic.
- If `tracker.js` changes, bump `TRACKER_VERSION`, `TRACKER_VERSION_CODE`,
  `MIN_TRACKER_VERSION_CODE`, `MIN_TRACKER_VERSION_LABEL`, rebuild the tracker
  EXE, and upload the release asset according to `docs/github-push-workflow.md`.

## Expected Debug Signatures

Current implementation open signature:

```text
DOOR_PA24_OPEN_START ...
A2A_DOOR_LVAR_OPEN_START profile=pa24_comanche ... writeOpenPosition=0 writeLatch=1 handleOpen=0 handleClose=1 latchUnlock=0 latchLock=1 ...
A2A_VAR_SET name=L:Door1Latch ... value=0 ... latch-unlock
A2A_VAR_SET name=L:Door1Handle ... value=0 ... handle-open
DOOR_PA24_OPEN_DONE ... lvarOk=1 ...
```

Current implementation hold signature:

```text
A2A_DOOR_LVAR_OPEN_START profile=pa24_comanche ... writeOpenPosition=0 writeLatch=0 handleOpen=0 handleClose=1 latchUnlock=0 latchLock=1 ...
A2A_VAR_SET name=L:Door1Handle ... value=0 ... handle-open
```

Current implementation close signature:

```text
DOOR_PA24_CLOSE_START ...
A2A_DOOR_LVAR_CLOSE_START profile=pa24_comanche ... writeOpenPosition=1 writeLatch=1 handleOpen=0 handleClose=1 latchUnlock=0 latchLock=1 ...
A2A_VAR_SET name=L:Door1Handle ... value=1 ... handle-close
A2A_VAR_SET name=L:DoorOpen1 ... value=0 ... openvar-0
A2A_VAR_SET name=L:Exit1Open ... value=0 ... exit-close
A2A_VAR_SET name=L:Door1Latch ... value=1 ... latch-lock
DOOR_PA24_CLOSE_DONE ... lvarOk=1 ...
```
