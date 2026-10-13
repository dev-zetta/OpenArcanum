# Editable TypeScript game scripts

The original SCR import produces **editable TypeScript source**, not an opaque
bytecode bundle. Source imports remain private under `local-data/scripts/arcanum/src`.
Normal builds strictly check those files with TypeScript 7 and compile CJS modules;
they never regenerate the editable source.

The first supported original gameplay witness is the Bates guards' heartbeat
(script 02894). The owned Inventory workshop supplies a separate scripted door,
a private message handled by a client script, and a delayed idle callback.
Structural conversion of all scripts does not mean the original campaign runs.

| Coverage | Current evidence |
| --- | --- |
| Conversion | All 2,399 SCR modules strictly compile with TS7; 709 DLG files are indexed. |
| Runtime operations | 17 named action APIs, three generated control-flow operations and seven condition APIs. The complete catalog describes 142 actions and 53 conditions. |
| Static operation subset | 296 scripts contain only those operation names. Operand selectors, dependencies and original semantic fidelity still require validation. |
| Witnessed behavior | Original 02894 guard heartbeats in the native Bates client, original 01162 through its recovered Caladon door attachment headlessly, and the owned scripted-door/client-message scenario. |

Run `npm run verify:scripts` for the private operation coverage and original 01162
reports. These reports separate conversion, implemented operations and witnessed
behavior; the static subset is not a playability count.

## Import, edit and build

On this development installation:

```sh
npm run import:scripts
npm run build:engine
npm run build:scripts
```

The importer defaults to `local-data/unpacked_data.zip`. Original developer
symbol descriptions come from the local C++ project's
`Data/data_wip/mes/Arcanum/semes` directory. Supply another extracted description
folder with `npm run import:scripts -- --descriptions PATH`.
The source archive and description files are local inputs, never downloaded or
published by this workflow.

Edit `local-data/scripts/arcanum/src/scripts/*.ts` and
`src/symbols/SharedSymbolCatalog.ts`, then run `npm run build:scripts` and restart
the world. A changed source or helper changes the compiled content identity;
checkpoints from a different build are rejected. Development saves are disposable.

The initial archive contains 2,399 SCR files (2,396 campaign scripts and three
module-template scripts), 23,858 instruction rows and 709 indexed DLG files.
`import-report.json`, `script-index.json`, `dialogue-index.json` and
`import-state.json` record the source identities and conversion diagnostics.
The DLG index does not implement dialogue expressions.
Eight explicit indexing diagnostics remain, including an original multiline
dialogue record. The 709 count is a file inventory, not complete dialogue-record
recovery.

Reimporting the same input is a no-op and reports files edited since import.
A changed archive, symbol input or generator version writes a separate candidate and a
comparison report. It never overwrites the editable source. Merge a candidate
explicitly after reviewing its differences. Only compiled output is disposable.
Converter changes that alter output must bump `GENERATOR_VERSION`.

## Readable code and stable identities

Each original row has a named TypeScript function. Conditions use ordinary `if`
statements; operations call named game APIs. `flow.jump(otherFunction)` returns a
continuation to the engine's bounded trampoline. It does not recurse through
JavaScript calls. All original numeric entry lines remain addressable.

```ts
import { defineScript, flow, defineDataKeys, schemaFromDataKeys, bindDataStore } from '@openarcanum/agate/script-api'

const sharedKeys = defineDataKeys({
  lastDoorUser: {
    default: null,
    validate: (value: unknown): value is string | null => value === null || typeof value === 'string'
  }
})

export default defineScript({
  id: 'my-module:door',
  name: 'Welcoming door',
  realm: 'server',
  sharedSchema: schemaFromDataKeys(sharedKeys),
  entryPoints: {
    0(ctx) {
      const timesUsed = ctx.attachment.counter(0)
      timesUsed.value += 1
      const shared = bindDataStore(ctx.shared.data, sharedKeys)
      shared.set('lastDoorUser', ctx.playerObject?.id ?? null)
      ctx.ui.message('Welcome back.', ctx.attachee?.id)
      return flow.runDefault()
    }
  }
})
```

The build tool supplies the SDK alias and emits its runtime bindings. The SDK
is also exposed through `@openarcanum/agate/script-api` with declarations.
See the owned [door](../examples/inventory-workshop/scripts/door.ts) and
[presentation handler](../examples/inventory-workshop/scripts/presentation.ts).

Original developer descriptions provide named global aliases. The imported
symbol catalog maps every alias to the original numeric identity. For example,
`symbols.flags.pcBoughtBatesHouse` refers to flag 2676, and
`symbols.variables.batesDoorGuardDeaths` to variable 1012. Named context aliases
and numeric references access the same cells. Changing a name must preserve its ID.
Conflicting descriptions, including flag 2730, retain a generic ID-based name.

The binary format contains no local-variable names. Scratch references therefore
start as `localNumber0`/`localObject0`, with explicit descriptive names where
reviewed. Local aliases are references to invocation cells, not copied values.
The import's `reviewed-aliases.json` can declare local names per script without
changing their indices:

```json
{
  "variables": { "1012": "batesDoorGuardDeaths" },
  "flags": { "2676": "pcBoughtBatesHouse" },
  "locals": {
    "arcanum:1000": {
      "numbers": { "0": "distance" },
      "objects": { "2": "guard" }
    }
  }
}
```

Invalid or colliding names reject the import. Changes to this reviewed map
produce an import candidate for review; existing edited TS stays untouched.
The imported source retains source hashes, original line markers, template
flags/counters, file flags and meaningful opcode names. Unsupported operations
remain visible calls and fail with script/row/operation diagnostics.

## Context and persistence

| API | Scope and lifetime |
| --- | --- |
| `ctx.shared.flags`, `.variables`, `.data` | Saved module/world state shared across its scripts. Original numeric cells are module-qualified. |
| `ctx.player`, `ctx.playerState(selector)` | Saved state of the selected actual player character. |
| `ctx.attachment.flag()`, `.counter()`, `.data` | Saved state of one object's attachment slot. Four counters are bytes; flags are 32 bits. |
| `ctx.locals`, `ctx.localNumber()`, `ctx.localObject()` | Fresh ten numeric and ten object scratch cells per invocation. |
| `ctx.data` | Saved custom state for the server script definition; session-local custom state for a client definition. |
| `ctx.triggerer`, `.attachee`, `.extra`, `.playerObject` | Immutable object identity views. Mutations use the game APIs. |

Optional `dataSchema`, `sharedSchema`, `playerSchema` and `attachmentSchema`
provide versions, defaults and runtime validators. Persistent data must be finite,
bounded JSON: primitives, arrays and plain objects. Store object IDs, not object
wrappers, functions or cyclic graphs. Nested calls share a transaction and world
services while receiving fresh scratch cells and the original call's correct
header/target rules.

Use `defineDataKeys` to declare named custom keys, defaults and runtime guards.
`bindDataStore(scope, keys)` exposes typed `get` and `set`: misspelled names and
values of the wrong TypeScript type fail compilation. The same helpers work with
`ctx.data`, `ctx.shared.data`, `ctx.player.data` and `ctx.attachment.data`.
The owned workshop demonstrates all four server scopes and client-local data.

Binding rejects malformed existing values before adding missing defaults and
revalidates declared keys before the transaction commits, including changes made
through the compatible raw JSON API. Defaults, object reads and object writes are
independent copies; edit a returned object and call `set` to save it. A binding
opts that invocation's scope into these declared keys. Use `schemaFromDataKeys`
as the matching scope schema to also validate the entire store during checkpoint
restore, before a handler runs. Its versioned schema requires exactly the declared
keys. Raw JSON stores and independently authored schemas remain supported.

`RunDefault` permits the engine's ordinary interaction. `SkipDefault` commits
successful script changes while suppressing that interaction. A script fault
rolls back its pending state, object changes, timers, RNG and messages. Door
preconditions and default writes are prepared before committing the script.
Client presentation is published after success to joined owner sessions only.

Execution is synchronous and bounded to 1,000 handler steps and 32 nested calls.
These are engine limits for generated flow; trusted arbitrary JavaScript is not
sandboxed. Original "every" conditions require a nonempty selection; selector
resolution and quantifier behavior live centrally in the SDK.

## Loading and authority

A manifest identifies each namespaced script, realm, source hash, compiled hash
and additional source/helper hashes. The loader verifies versions, hashes and
paths and maintains a fresh module cache for each session. Editing the canonical
TS requires rebuilding; editing compiled output alone fails integrity checks.
World/session disposal clears module caches, persistent in-memory stores and
scheduled calls. Disposed engines/loaders refuse further execution, and previously
prepared transactions cannot commit or publish effects into a later session.

Server contexts own gameplay state and transactional operations. Client contexts
contain presentation events, local data and UI APIs. The workshop's client
module counts and displays private messages. No executable source, filesystem
path or arbitrary script selection is accepted through client commands.
Presentation events carry an epoch, sequence and world revision. Loading a
checkpoint advances the epoch, clears client state and discards stale messages.
Messages are transient and are not replayed to newly joined clients.

Version 1 accepts **trusted locally installed modules**. It does not isolate
untrusted downloaded code from Node or the current Electron renderer.

## Bindings, time and supported scenarios

`rules/ScriptBindings.json` stores object source paths, original event slots,
script identities, attachment flags and four counters. Null script IDs preserve
explicit empty slots. Instance overrides and prototype defaults remain distinct.
Original slot 1 is Use; slot 19 is Heartbeat. Other recovered slots are retained
without claiming their events are implemented.

The local MOB recovery tool validates identity, type, prototype and location
against converted data before writing bindings:

```sh
node @openarcanum/agate/tools/recover-scripts.cts \
  --archive local-data/unpacked_data.zip \
  --prototypes ../my_projects/OpenArcanumCpp/Data/\#UNPACKED.zip \
  --converted 'local-data/archives/Bates Mansion Lev 2.zip' \
  --data local-data --map 'Bates Mansion Lev 2'
```

Sector recovery parses sequential records and preserves source offsets, object
ordinals, tile coordinates and inherited/cleared attachment distinctions.
Ambiguous correlation must be reported instead of assigning a nearby object.
The Bates recovery retains all 343 original static attachment tables in private
evidence and correlates 84 interactive static objects plus 53 MOBs. Ten unmatched
interactive records and unbound wall identities remain explicit; no wall script
event is enabled. Its 31 portals have no original script attachment. Eight
Scenery Use attachments are recovered but their travel operations are inactive.

`rules/ScriptModule.json` selects a manifest and explicitly enabled original
heartbeat scripts. The current retail profile enables 02894; recovered 01195 and
other unsupported events stay outside that profile. Script 01162 is a genuine
recovered headless door-gating witness. Scenery travel/use scripts, unlock
scripts, original quests, DLG expressions, combat and full NPC AI are unfinished.

The server advances script time while the actor is idle. Game time advances 8x
elapsed time with a 250ms elapsed cap, and freezes during local pause/checkpoint
IO. There is no offline catch-up. Generic `ctx.game.schedule` delays use game
seconds; the original `callScriptIn` operation applies its additional 8x scaling.
`callScriptIn` starts a fresh Use invocation with no extra object. `callScriptAt`
remains unsupported. Signed division truncates toward zero; a zero divisor leaves
the destination unchanged. Signed division overflow faults and rolls back the
transaction. Attachment counter writes wrap to one byte. These behaviors were
checked against the supplied executable's instructions in Ghidra; reference-game
input/output tests for these arithmetic cases remain outstanding.

Noncombat heartbeats use the reconstructed distance-based delay and initial
jitter, with saved due time/RNG. Off overrides are owned by object instances;
rendering, targeting and collision consult them without editing prototypes.
Schema 7 / rules v11 checkpoints retain those overrides, attachment removal,
script stores and pending calls, validating restored collision against candidate
state. Protocol 2 carries the public object changes and private presentation.
