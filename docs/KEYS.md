# Standalone keys and locked access

The local authority supports whole standalone Key transfers and key-authorized
opening of explicitly supported doors and private access to supported locked
containers. The same `take`, `put`, `take-all` and
target-only `use` commands serve the owned workshop and ordinary client UI.
No client supplies a lock number or declares that it possesses a matching key.

## Access rule

The server resolves keys from the controlled actor's explicitly known,
reciprocal inventory. A supported Key has an immutable positive signed integer
`Key.keyId`, valid item placement and no additional item flags. Key transfers
and this access path require an actor without a keyring; ring conversion and
merging remain unfinished. Keys in another owner, an unsupported source or an
unknown inventory do not authorize access. A key in a locked container is not
considered initially attainable unless another verified attainable key can
authorize that container. This fixed initial closure starts with the actor and
supported unlocked containers, then admits matching reviewed locked sources.
A key behind its own lock or a disconnected cycle cannot bootstrap itself.
This establishes the supported ownership universe; it does not grant possession
or prove a walkable route.

Zero never matches. ID `1` on either the key or lock is the original master
case; otherwise the IDs must be equal. A locked supported door checks possession
before choosing its approach and again on arrival. A server-rejected or interrupted
request cannot open the door. Key use preserves the key's identity and ownership
and leaves `Locked` unchanged. The open pose changes collision as for other
doors. An open supported door can be closed without retaining its key, subject
to the existing occupied-door check; opening it again requires access again.

A supported locked container checks the currently held key before approach,
on arrival, on private inspection and on every Take, Put or Take All request.
Its contents are never cached as permanent permission. Access leaves `Locked`
unchanged and does not consume or move the key. Putting the key away therefore
blocks later access. Putting the sole matching key inside that same locked
container is allowed by an authorized Put, but may leave it inaccessible until
another matching key is held. Initial closure prevents inaccessible baseline
cycles; it does not prevent the player from putting a key away.

Original behavior was checked in the local arcanum-ce sources:

- [Possession and matching](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L1623): direct keys, keyrings and the zero/master/equality rule.
- [Portal opening authorization](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/ai.c#L3745): scripts and lock checks authorize opening without clearing the lock.
- [Container opening authorization](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/ai.c#L3830): the ordinary lock/key check preserves the lock and key.
- [Original container UI](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/ui/inven_ui.c#L565): opening runs the authorization check and a separate `SAP_USE` script veto.
- [Explicit lock changes](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/object.c#L4060): clearing a lock is a separate operation with timed behavior.

The repeated per-command access checks are the development authority policy.
They are not a claim that the original UI repeated its opening checks for each
inventory drag.

## Explicit support and remaining gaps

The historical converter discarded original script references and keyring
contents. Missing converted fields therefore cannot prove a target has no script
veto or that a ring contains a key. Key opening requires the reviewed authored
declaration `Portal.keyUseSupported: true` for a door or
`Container.keyUseSupported: true` for a container. The respective lock fields
are `Portal.keyID` and `Container.keyId`. Lock IDs and support markers are fixed
for the session. Unmarked imported targets retain the previous locked rejection.
The original Bates scene and its unknown actor inventory remain intact.

Timed locks, magic, jams, damage, AlwaysLocked directional behavior, script
execution, followers, party key sharing and lock picking remain unfinished.
Original key names still require the module key-description table and currently
display the safe **Key** type label.

Public target state contains its ordinary open/locked pose and structural support,
independent of private key possession. Key item IDs, key numbers and actor
inventory stay outside public snapshots and late joins. Private transfer replies
contain the same bounded item descriptors used for Generic items.

## Owned scenario and persistence

The [inventory workshop](../examples/inventory-workshop/README.md) retains its
original token loop and adds a key crate at `(3, 7)` and a locked door at
`(10, 6)`. Take the crate's key, use the second door, walk through it, then put the
key back. Closing succeeds; another opening attempt rejects until the key is
held again. A third crate at `(6, 8)` uses the same matching ID and explicitly
opts into container key access. With the key held, inspect it and take, put or
retake its **Workshop keepsake**. After putting the key into an unlocked crate,
new use, inspection and transfer requests to the locked crate reject. The
keepsake, token and key retain stable IDs and reciprocal ownership; the actor
still starts empty. No original game data is required.

Current checkpoints use document schema 6 and rules
`movement-doors-ownership-attributes-v9`. They persist the same complete door poses and
supported reciprocal ownership. An open door can be saved after its key is put
away: restore checks whether the immutable supported key universe could supply
access, rather than requiring the current actor to hold it. Unsupported doors
and doors without an attainable verified key retain their imported pose.
Supported locked-container ownership can be restored with the key put away;
loading never grants current access or clears the lock.
Development saves are disposable; only current rules are supported, with no
older-rule compatibility or migration path.

The separate [ground-item slice](GROUND_ITEMS.md) opts in only the new Generic
workshop pebble. Standalone Keys retain their existing container transfers and
key access; they cannot be dropped or picked up from the floor in this slice.

Primary-source and original-record research stays private under
`local-data/research/keys/`.
