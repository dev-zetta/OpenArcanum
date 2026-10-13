# Owned carrying capacity

The [inventory workshop](../examples/inventory-workshop/README.md) now makes
its neutral-human actor's Strength-based carrying capacity an authoritative
inventory rule. The owner sees the carried weight, capacity and encumbrance band
in stone. A supported private item row shows its whole-item weight too.

At Strength 8 the capacity is **4,000 stone**. The separate crate at `(11, 2)`
contains **Workshop ballast**, a whole Generic item weighing exactly 4,000 stone.
An empty actor can take it. Taking the one-stone Workshop token afterward rejects
with `TOO_HEAVY`, without changing either owner list. Spending one Character
Point on Strength raises capacity to **4,500 stone**, permitting the same token.
Put or Drop releases capacity, and Pickup checks it again.

This ballast is an authored boundary witness, not an original item or a claim
about campaign balance. Its crate does not change the existing token, key,
locked-keepsake or quest batches. Its procedural floor artwork supports the
same whole-item Drop/Pickup path as the workshop pebble.

## Supported rule boundary

Only the explicitly opted-in `neutral-human` progression profile supplies a
capacity. Its effective Strength currently equals its purchased base Strength;
the reviewed neutral formula is `500 × ST`, bounded to 300–10,000 stone.
Imported actors and unknown character profiles do not acquire inferred stats
or carrying rules. Their private inventory can omit `carrying`; the client treats
an absent field or `carrying: {supported:false}` as unavailable carrying rules.

A supported inventory reports
`carrying: {supported:true,weight,capacity,encumbrance}`. Weight and capacity are
nonnegative integer stone totals, with positive capacity. Only the owner receives
this metadata and held-item weights; public observer snapshots contain neither.
The client validates the committed row weights and total instead of calculating
an optimistic transfer.

The weightable subset is whole **Generic** items and standalone **Key** items.
`Item.weight` must be a nonnegative safe integer and `Item.magicWeightAdj` must
be absent or zero. The fixed item universe captures these fields as immutable
simulation identity. Missing, invalid or changed held/incoming weight rejects
as `INVENTORY_UNAVAILABLE`; it never becomes an invented zero-weight item.
Unsupported container-only families can still be inspected without a claimed
weight. Their existing transfer restrictions remain in effect.

Take, Pickup and Take All preflight the complete incoming weight before any
ownership mutation. Equality with capacity is permitted; a total above it
rejects with `TOO_HEAVY`. Take All does not skip heavy items or commit a partial
batch. Put and Drop may shed valid weight even when an existing actor inventory
is overloaded. Every operation still requires the current ownership, access,
range, revision and action-state checks.

Encumbrance uses these reviewed strict upper bounds. At an exact boundary, the
next band applies; for example, exactly 600/4,000 stone is light.

| Band | Carried weight / capacity |
| --- | --- |
| none | below 15% |
| light | 15% to below 30% |
| moderate | 30% to below 45% |
| medium | 45% to below 60% |
| significant | 60% to below 75% |
| heavy | 75% to below 90% |
| severe | 90% and above |

The band is information in this slice. **Movement speed and fatigue do not yet
change with encumbrance.** Equipment, stacks, Gold/Ammo weight rules, magical
weight adjustments, keyrings, grid packing, racial/background effects and the
full original item insertion policy remain unfinished.

## Persistence and verification

Current schema 7 checkpoints use
`movement-doors-ownership-attributes-weight-scripts-v11`. Carrying totals are recomputed
from the validated item ownership and restored character attributes, not saved
as an independent client-provided balance. Only the current rules contract is
accepted.

The native workshop smoke runs an independent capacity phase before the
existing full scenario: save the pristine empty ST8 actor; take exactly 4,000;
reject one more stone through the real control; buy Strength; take the formerly
rejected token; Put, retake, Drop and Pickup the ballast; then load the pristine
checkpoint. The restored actor has capacity 4,000, no items and its five original
points; both crates regain their original contents. The later quest/key checks
therefore begin from their original baseline. Core/socket tests separately
exercise batch rejection, races, malformed weights and rollback.

## Evidence and limits

The supplied manual's physical PDF pages
[19](../local-data/reference/manual/manual.html#page-019),
[49](../local-data/reference/manual/manual.html#page-049),
[56–57](../local-data/reference/manual/manual.html#page-056) and
[115](../local-data/reference/manual/manual.html#page-115) establish carrying
capacity, inventory weight/encumbrance display, burden penalties and stone units.

The locally inspected arcanum-ce revision
`36cd712d135bfb76fa6d0ede6803d521a2b391f7` corroborates
[capacity](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L557),
[whole-item and total weights](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L365),
[strict insertion rejection above capacity](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L3639), and
[encumbrance thresholds](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/critter.c#L2142).
That code also shows excluded stack, magical-weight and keyring branches.

These are manual and reconstructed-code findings. This slice has no matched
runtime carrying-capacity observation from the supplied original executable.
The native witness validates OpenArcanum's declared owned subset. Original
encumbrance speed penalties, fatigue timing and exact animation movement need
separate data/reference scenarios before implementation.
