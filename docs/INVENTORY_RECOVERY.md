# Recovering inventory ownership

The historical C++ converter discarded inventory ownership relationships. This
note records the local recovery tool, private container inspection and the
narrow whole Generic/standalone-Key Take/Put and atomic Take All paths added on
October 12, 2026. The owned workshop supplies its known-actor transfer witness and schema 6
ownership checkpoint;
complete original inventory rules remain unfinished. Original and converted
game data remain private in ignored local storage.

## What the converter omitted

In `Source/Converter/agate/arcanum/entity/specific/entity_container.cpp`,
`AContainerEntity::loadFields` skips `InventoryListIdx` as a dynamic field.
`InventoryNumber` is exported as `Container.inventoryIndex`; despite that name,
it is a count, not an ownership identifier. The critter converter also skips its
inventory list.

`entity_item.cpp` reads the full object ID in `Item.Parent`, but `toJson` never
exports it. The converted item's map location and inventory-slot number cannot
replace that parent. Items carried by NPCs and stored in containers retain map
coordinates that differ from their owner's coordinates.

## Available original records

The locally retained extracted archive contains standalone original binary
records under `#UNPACKED/Arcanum/maps/Bates Mansion Lev 2/G_*.mob`. Recovering
ownership for this map does not require decoding retail DAT files or embedded
SEC objects. Historical `.mob.json` files in the same archive have already lost
the relationships and should not be treated as a substitute for the MOB bytes.

All **53 MOB records** were parsed in memory with the field definitions from
arcanum-ce commit `a7ff41b300ef712f0e7d088183a3d08957110cdd`. Every record consumed
exactly its file length and matched the header's overridden-field count. The tool
also parses all 19 referenced original prototypes to exact EOF before resolving
inherited ownership defaults:

| Record | Count |
| --- | ---: |
| Containers | 15 |
| Items | 32 |
| NPCs | 6 |
| Items whose parent is a container | 13 |
| Items whose parent is an NPC | 19 |

All 32 item parent IDs resolve to another MOB record. Each container's inventory
list length matches its inventory count, and all 13 container memberships have
a matching reverse `Item.Parent`. This provides a complete ownership witness
for these standalone map records, without assigning items by proximity.

## Format and primary sources

The original instance header is little-endian:

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | `u32` | File version `0x77` |
| 4 | 24-byte ObjectID | Prototype ID |
| 28 | 24-byte ObjectID | Instance ID |
| 52 | `u32` | Object type |
| 56 | `u16` | Number of overridden fields |
| 58 | `u32[]` | Overridden-field bitsets |

Fields are serialized in base, parent-class and subtype order. Each section has
its own bitset rounded up to 32 bits: base uses two words; containers add one;
items add one item word and one subtype word; NPCs add two critter words and one
NPC word. Interpret the bits using the declared field order, including fields
that are irrelevant to inventory, so the reader remains correctly aligned.
See [instance loading](https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/obj.c#L3032)
and [field enumeration](https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/obj.c#L4629).

An [ObjectID](https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/obj_id.h#L21)
is 24 bytes: `i16 type`, `i16 padding`, `i32 padding`, then a 16-byte union.
Type `1` contains a numeric prototype ID at offset 8; type `2` contains a GUID
at offset 8. GUIDs use the original Windows byte order. Other ID variants must
be explicitly supported or rejected, rather than interpreted as GUIDs.

[Field serialization](https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/obj_private.c#L657)
stores `INT32` directly as four bytes. `INT64`, `HANDLE`, strings and arrays begin
with a one-byte presence marker. A present `HANDLE` then stores one ObjectID.
`Container.InventoryListIdx` is a `HANDLE_ARRAY`; `Item.Parent` is a `HANDLE`.
Their types are declared in
[the object field table](https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/obj.c#L3603).

A present [sizeable array](https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/sa.c#L319)
contains `u32 elementSize`, `u32 count`, a historical `u32 bitsetID`, then
`elementSize * count` payload bytes. The payload is followed by a `u32` bitset
word count and that many `u32` words. The serialized bitset maps packed payload
entries to sparse logical indices; the historical bitset ID is not ownership
or a pointer to another file. Inventory handle entries have size 24.

## Verified container witness

The chest at runtime tile `(98, 94)`, instance
`E505FDAB-0E4E-11D4-8F1D-00E02920220C`, uses prototype 3044. Its original record
declares two inventory entries. They resolve to 62 gold, prototype 9076, and a
rough sapphire, prototype 15148. Both item records point back to this chest.
The gold quantity agrees with the existing converted `Gold.quantity` field.

The chest is explicitly locked, key ID 64, lock difficulty 35. All six nonempty
containers in this map are explicitly locked. Three empty containers inherit
the prototype's `Locked, NeverLocked` combination and are effectively unlocked
because `NeverLocked` takes precedence. Inventory recovery must not remove
locks, reveal inaccessible contents in the gameplay UI or manufacture an
unlocked loot witness.

## Recovery tool and implementation boundary

The recovery tool reads the locally supplied original MOB and prototype records and emits
instance-only `Container.inventory`, `Critter.inventory` and `Item.parent` metadata using canonical
converted source paths. It preserves sparse ownership-list indices and quantity
fields, and records source-entry hashes in an ignored recovery manifest. NPC
ownership can be retained without enabling theft, equipment or NPC inventory UI.

The tool rejects truncated or unsupported records, invalid presence markers, inconsistent
field counts, unknown override bits, invalid array sizes/bitsets, duplicate IDs,
missing references, conflicting parents and nonreciprocal membership. It consumes
the entire record, correlates original IDs, prototypes and types with the converted
entries, and never infers ownership from coordinates or inventory-slot numbers.

For imported original content, recovery is a prerequisite for server-owned item
identity and atomic transfer; the recovery tool itself does not execute gameplay
rules. Owned modules can declare their relationships directly. The server
enforces a narrow lock/range policy and validates reciprocal links before
private inspection. Whole Generic/standalone-Key Take/Put and Take All additionally require
known actor inventory, a fresh inspection revision and known containers admitted
by the fixed initial supported-source closure and accessible at the time of use.
Marked locked containers can be admitted through verified attainable keys;
current access still requires a matching key held by the actor. Supported
ownership now participates in checkpoint save/load. Keyrings, lock picking,
equipment, stacks, weight/capacity,
retail ground transfers, barter and unrestricted transfer remain unfinished.

## Run and install locally

```sh
node @openarcanum/agate/tools/recover-inventories.cts \
  --original '../my_projects/OpenArcanumCpp/Data/#UNPACKED.zip' \
  --converted 'local-data/archives/Bates Mansion Lev 2.zip' \
  --data local-data --map 'Bates Mansion Lev 2' \
  --output local-data/inventory-recovery
```

Use `--dry-run` instead of `--output` for validation only. The output directory
must be new and inside this checkout's ignored `local-data/`. The tool reads
current loose instance overlays before writing, preserves their unrelated
fields, and rejects conflicting ownership metadata. Source archives are untouched.

Review `recovery-manifest.json`, back up any existing loose instance files, then
install the emitted instance files at the same relative paths under
`local-data/`. Keep existing `Map.json` and `Sector.json` roof/light overlays.
Restart the application after installation. The new metadata changes the
simulation content fingerprint used by checkpoint validation.

The runtime metadata is `{ inventory: [{ id, slot }] }` on each recovered
Container/Critter component and `{ parent: ownerSourcePath }` on each Item.
Explicit `inventory: []` means known empty, either recovered from original records
or initialized by an owned module; an absent field means unknown.
Here `slot` is the original sparse ownership-list index. It is independent of
`Item.invLocation`, which also represents UI/equipment positions: 17 of the
32 Bates records have different values, including inherited zero defaults.
The chest's sapphire has ownership index 1
and item location 2; an NPC armor record has index 3 and equipment location 1006.
The recovery leaves item locations and quantities unchanged.

The current **Containers** panel approaches and inspects an accessible container.
The dresser at `(78, 86)` is an authentic unlocked, empty witness. The chest at
`(98, 94)` remains locked, and its contents are unavailable through gameplay.
The original Bates controlled actor has unknown inventory, so its container
inspection remains read-only. The separate owned workshop demonstrates taking
an item without changing this actor template or unlocking original containers.
Equipment, capacity/weight, identification, theft, original-content key use and
lock picking are still unfinished.

## Owned inventory acceptance module

These 53 Bates records contain no ground items or key/key-ring instances. All
six nonempty containers are locked. The controlled development actor is loaded
from the separate `16086.json` template, outside these recovered map records;
its omitted inventory list is unknown, even though its converted count is zero.
Neither an empty container nor that count establishes a usable transfer/key
scenario. Original locks and actor data should retain their provenance.

The [Inventory workshop](../examples/inventory-workshop/README.md) now provides
that separate owned witness. Its map, prototypes, actor, crates, token, keepsake,
pebble, key, doors and
PNG artwork are authored by a deterministic generator and included in the public
source. It runs without an original game installation or the recovery tool.
The map declares start tile `(4, 4)`; the crate at `(6, 4)` holds one generic item
with reciprocal source-path links. Its owner-list index is `3`, while
`Item.invLocation` is `7`, preserving the distinction exercised by original data.
The owned actor explicitly declares `Critter.inventory: []`, count zero and
inventory source zero. The original Bates actor template remains unchanged.
The module's 89 generated files also include a key crate at `(3, 7)`, a
standalone key with ID `7001` in slot `3`, and a matching locked door at `(10, 6)`.
The existing unlocked door remains at `(8, 4)`. A third crate at `(6, 8)` is
explicitly locked with the same key ID and opts into authored key access. It
contains a distinct generic keepsake in owner-list slot `3`, with item location
`0`; the original token and key records remain unchanged. A separate parentless
Generic pebble at `(4, 7)` supplies the only opted-in ground-item witness.

```sh
OPENARCANUM_MODULE=inventory-workshop npm start
```

The module uses the existing server-controlled approach, private inspection,
movement and local pause. The Containers panel offers **Take** or **Take All** for
its Generic token after inspection; the private actor inventory then shows the
same item with **Put** for the selected freshly inspected container. Taking, putting back
and retaking move the same token through owner-list slots crate `3` → actor `0`
→ crate `0` → actor `0`. Both directions choose the destination's lowest unused
slot and change `Item.parent` reciprocally. `Item.invLocation` remains `7`; the
token count stays one. Schema 3 checkpoints save and restore these
relationships alongside actor position and managed door states. The fixed
metadata manifest describes this example and required assets; it is not a
general module loader or mod API.
The owned module now has token, standalone-key, locked-keepsake and ground-pebble loops. Temporary
core/socket fixtures exercise multi-item batches, sparse ordering, mixed
unsupported contents and atomic rollback; no retail loot is added or unlocked.

## Private item names

Private container and actor-inventory rows now resolve labels from the effective
prototype and instance fields using an optional local `mes/Description.json`.
`Base.descIndex` is the original description ID; `Base.nameIndex` is a separate
field and cannot replace it. The authority uses the original identification gate:
a verified numeric nonpositive `Item.magicTechComplexity` or the explicit
`Identified` flag selects `Base.descIndex`. Positive or missing complexity without
that flag selects only `Item.descriptionUnknown`. An absent unknown-name entry
never falls through to the actual name.

This first resolver supports system description IDs below 30000. Missing,
malformed, ambiguous or unsupported entries retain the safe item-type label.
Module descriptions, key names and effects require separate mappings and remain
outside this slice. Held and container names travel only with authorized private
item rows; the opted-in pebble publishes its permitted label while visible on
the floor. Lock checks and unknown actor ownership retain their existing
boundaries. Resolving a name neither identifies an item nor permits taking it.
See [Item display](ITEM_DISPLAY.md) for source evidence and limits.

The owned token and keepsake explicitly declare description IDs 9003 and 9006
and mundane complexity zero. Their generated description table supplies
**Workshop token** and **Workshop keepsake**. The token's stable identity,
owner-list slots and `Item.invLocation: 7` are unchanged. The keepsake's name
is available only through an authorized private response. Description row 9007
supplies **Workshop pebble**, with explicit mundane complexity zero.
Description text is presentation data outside simulation identity. Original
retail prototypes and unknown fields are not modified or filled with guessed
defaults. Keys retain the safe **Key** label until their separate name table is
supported.

## Owned matching-key loop

The key crate can be inspected and its whole standalone Key taken, put into an
eligible container and retaken through the same private transfer path as the
token. Key support requires a known actor inventory without a keyring, empty
supported item flags and an immutable positive key ID. The authority selects a
possessed matching key from verified actor ownership; a use request sends
only its target ID. It checks possession before approach and again on arrival.
ID `0` never matches, ID `1` on either side is a master match, and other positive
IDs must be equal.

Opening the authored door or accessing the authored locked crate consumes no
key and leaves `Locked` unchanged. Closing an already open supported door needs
no key. The explicit `Portal.keyUseSupported: true` or
`Container.keyUseSupported: true` marker is mandatory because the historical
converter discarded `ScriptsIdx`; missing converted attachments cannot prove
that original unlock/use scripts would allow access. Lock IDs use `Portal.keyID`
for doors and `Container.keyId` for containers; these fields and the support
markers remain immutable. Original Bates targets have no marker and retain
their previous locked guards. Jammed, magical,
timed, busted, sticky and AlwaysLocked behavior is still unsupported. Keyrings,
party/follower sharing, lock picking, script execution and key names need their
own rules. See [Matching keys](KEYS.md).

The locked crate requires the held key on use before approach and on arrival,
on inspection and on every Take, Put or Take All. Those per-command checks are
the development authority policy, rather than a claim about original UI drag
behavior. Putting the key into an unlocked crate blocks subsequent locked-crate
access while preserving the keepsake's ownership. An authorized Put may also
place the sole key inside the locked crate itself; subsequent access then needs
another matching key. There is no persistent unlocked-container state.

## Authored ground ownership

Only the new workshop pebble opts into whole Generic pickup and drop through
`Item.groundTransferSupported: true`. It has static owned Item artwork, no
authored Inventory flag and an explicitly null parent. The original three items
gain neither the marker nor Drop support; Keys and retail items remain outside
ground support. Missing original scripts cannot establish permission to run
`SAP_GET`, `SAP_DROP` or inventory hooks, so missing metadata never opts in.

Use approaches the pebble; a separate current-revision Pickup rechecks floor
state and cardinal range before assigning actor membership at the lowest unused
owner-list slot. Drop removes actor membership and places it at the actor's tile,
rejecting another ground item there. Both directions conserve the fixed instance
and use the usual pause, busy, permission and replay guards. Runtime
`entity.ground` and location override display while authored flags stay unchanged.
Held locations canonicalize to the authored coordinate, and `Item.invLocation`
remains unchanged as development metadata. Original junk piles, decay, grid
packing, stack merging and throwing remain unfinished.

Current floor descriptors are public, including the permitted item name and
location. Picking up the pebble removes its ID and name from public floor state;
its actor/container membership stays private. See [Ground items](GROUND_ITEMS.md)
for the primary-source evidence and exact boundary.

## Narrow transfer and checkpoint contract

The server accepts whole Generic/standalone-Key Take/Put between a verified
controlled-actor inventory and known containers with validated reciprocal
contents. A container must belong to the fixed initial supported-source closure
and be accessible when the action is requested. The closure starts with verified
actor ownership and supported unlocked containers, then admits reviewed locked
containers whose lock matches an attainable supported key. It repeats to a
fixed point; a key behind its own lock or a disconnected cycle cannot bootstrap
itself. This is an ownership-support boundary, not current possession or proof
of a walkable route. Put can target any eligible accessible container, rather than only an
item's original owner; that item can then be retaken from the destination.
Eligible items must originate in the verified actor or an initially attainable
known container and retain their supported item behavior. Standalone Keys also
require no actor keyring and an unchanged positive key ID. The request
identifies the container and item and includes the inspected world revision. A
world change requires a new inspection. The server rechecks range, locks,
membership, item support, owner permission, replay, movement/busy and pause
state. The client cannot choose a destination slot, parent or owner count. This
rule supports those whole instances without stack splitting or other item categories.

Take All requests identify only the container and inspected revision; clients
cannot submit an item list. The server selects all current contents in sparse
slot/ID order. The container must be nonempty and every row must pass the same
whole Generic/standalone-Key support checks. Known actor ownership, fixed initial
container eligibility, current held-key access, fresh revision, range, locks,
permission, replay, pause, movement and checkpoint/busy guards all apply. An unsupported row or insufficient
owner-list capacity rejects the entire batch before writes. It never skips an
item, creates an item or commits only part of the contents.

One synchronous transaction removes the source entry, adds the existing item to
the destination's lowest unused nonnegative owner-list slot, adjusts both owner
counts and updates the item's parent. This allocation applies in both directions;
putting back an item need not restore its original sparse slot. Failed writes
roll back. Stable identity, reciprocal membership and the complete item set are
preserved; item UI locations,
flags and quantities are not repurposed as transfer state. Private contents and
actor inventory travel in the requesting owner's acknowledgement, outside
public snapshots and observer joins. The client refreshes or invalidates private
views after committed changes rather than granting ownership optimistically.
Take All performs those ownership changes for the complete selected set in one
transaction, filling the actor's lowest free slots, including holes. Failed
writes restore both owner lists/counts and every item parent. A successful batch
publishes one revision; its private acknowledgement carries ordered transferred
item IDs, remaining container contents and actor inventory. The public command
summary contains the action and container ID only, with no item IDs or contents.

Checkpoint schema is version 6; current ownership rules are
`movement-doors-ownership-attributes-v9`. The document records every known owner's
membership/count and every item parent in the established ownership universe.
Each item record also has `groundLocation`: a supported floor item has a valid
tile tuple and null parent, while actor/container items have null ground
locations. Validation rejects duplicate floor occupancy and conserves the exact
item set through pickup/drop as well as container transfers.
Before saving or restoring, validation requires the exact known-owner and item
sets, unique membership and sparse slots, matching counts and reciprocal
parents. Transfers must fit the supported actor/container rule and slot
allocation bounds. Put can leave legitimate holes in actor and container
inventories; these are preserved instead of requiring compact membership.
Immovable items must retain their original owner and sparse slot. Content/rules
compatibility and unchanged item identity fields are also required. Load prepares
ownership, position and doors before applying them, and rejected loads leave
live state intact. Owners whose metadata was absent remain unknown; the original
Bates actor's omitted inventory is not initialized or rewritten.
An authored key door may retain a checkpointed open pose after its key has been
put away. Validation uses the immutable verified attainable key universe,
alongside supported door metadata; it does not require current possession for
an already reached open pose. Opening a closed door still requires possession.
Supported ownership in the locked crate also persists with the key put away;
restore does not clear its lock or grant access without a held key.
The pebble's floor/held state and drop location restore together with actor
position and door poses. Only the current schema 6/rules v9 contract is accepted.
This is supported
ownership persistence, not a complete campaign save. Character statistics, NPC
behavior, quests, timers and RNG remain outside the checkpoint, and M2 remains
incomplete.

Equipment, stacks, weight/capacity, keyrings, retail ground transfers, barter and
unrestricted transfers still need separate rules and acceptance scenarios. Original-content
key behavior needs a matching possessed key and its own reference-backed witness.
This batch operation does not establish full original take-all behavior for
retail loot, corpses, equipment, stacking or weight rules.
