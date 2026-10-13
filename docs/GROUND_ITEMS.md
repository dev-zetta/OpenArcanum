# Authored ground pickup and drop

The local authority supports whole-item pickup and drop for one explicitly
reviewed Generic item: the [workshop pebble](../examples/inventory-workshop/README.md).
The client requests an action; the server owns its location, membership and
placement. Existing token, keepsake and Key transfers remain unchanged and do
not gain Drop support.

## Current rules

A supported ground item declares `Item.groundTransferSupported: true`, empty
item flags, an explicitly null parent, nonblocking authored flags and static
Item artwork. Its stable ID enters the fixed item universe when the authority
starts. The actor must have verified inventory ownership. Missing or changed
support metadata, unsupported item behavior and unknown actor ownership do not
grant access.

`use` selects only the ground target and approaches a cardinal neighbor. Pickup
is a separate request naming that target and the current world revision. The
server rechecks that it is still on the floor and within Manhattan distance one,
then adds the same item to the actor's lowest unused owner-list slot. No item is
created and a repeated or stale request cannot grant another copy.

Drop names only a supported held item and the current revision. The server
chooses the actor's current tile, removes reciprocal actor membership and places
the same item there. Portal tiles reject placement even while open. A tile
already containing another ground item rejects;
this slice creates no junk-pile container. Pause, movement, checkpoint, replay,
permission and busy guards apply. Private replies refresh actor ownership;
the client does not grant it optimistically.

Authored `Base.flags` stay immutable. Runtime `entity.ground` and location
represent the floor/held transition; the renderer hides held items and shows
only current ground items. Held location canonicalizes to the authored
coordinate, rather than tracking the actor. `Item.parent: null` is the engine's
explicit ground representation. `Item.invLocation` remains unchanged as
development metadata; it is separate from the allocated owner-list slot.

Public `groundItems` contains only visible loose-item descriptors, including
their permitted label and location. Picking up an item removes its ID and name
from public floor state. Container contents and held inventory remain private;
observers and late joins do not receive them. Dropping makes that same item
publicly visible again. The current list covers the loaded map; per-player
visibility and interest filtering remain future work.

## Original behavior and limits

The locally converted manual, PDF page 50, describes dropping at a character's
feet and combining multiple items into a junk pile. The locally inspected
arcanum-ce revision also establishes the following behavior:

- [Ground pickup](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L610) executes `SAP_GET`, checks insertion rules and moves the object into inventory.
- [Drop](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L703) executes `SAP_DROP`, checks removal rules and uses the owner's tile for a zero-distance drop.
- [Removal checks](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L3876) reject `NoDrop` and apply equipped-item constraints.
- [Original world transitions](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/object.c#L3802) clear or set the inventory flag and update sector registration.
- [Parent lookup](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L319) treats a non-inventory object as parentless even if a stored handle remains.
- [Junk piles and decay](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L3906) add behavior beyond a single loose object.

The current null-parent model, preserved UI location, cardinal approach and
same-tile rejection are explicit development policies. Original grid packing,
weight, equipment, stack splitting/merging, keyring conversion, throwing, junk
piles and decay remain unfinished. The converter discarded `ScriptsIdx`; absent
converted scripts cannot establish that original `SAP_GET`, `SAP_DROP` or
inventory hooks would permit an action. The authored marker is therefore
mandatory. Keys and original retail items are outside ground support in this
slice, and original Bates data stays unchanged.

## Persistence

Current checkpoints use schema 5 and `movement-doors-ownership-progression-v8`. Every item
record has `id`, reciprocal `parent` and `groundLocation`: a supported floor
item has a validated tile tuple and null parent, while held or container-owned
items have a null ground location. Validation conserves the exact item universe,
rejects duplicate ground occupancy and applies ownership, actor position and
door poses together. Save/load supports both a held pebble and a dropped pebble
at its chosen tile. Only the current contract is supported; development saves
are disposable.

Primary-source and local-manual evidence remains private under
`local-data/research/ground-items/`.
