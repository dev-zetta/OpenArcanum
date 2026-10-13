# Inventory workshop

A small owned test module for OpenArcanum. Its map, character, guide, crates, doors and
artwork are authored by the deterministic [generator](generate.cjs), using only
Node built-ins. No original game data, artwork or installation is required.
The module and its generator use the repository's GPL-3.0-or-later license.

The generic items display as **Workshop token**, **Workshop keepsake** and
**Workshop pebble**. Their owned prototypes supply `Base.descIndex` values
`9003`, `9006` and `9007` and explicit
`Item.magicTechComplexity: 0`; the generated `data/mes/Description.json` supplies
those names. The authority resolves names using the original identification gate:
nonpositive complexity or an explicit `Identified` flag permits the actual
description; otherwise it uses only the unknown description. Missing or invalid
text uses a safe item-type label. This adds private labels, with no identify
action or new examination statistics. See [Item display](../../docs/ITEM_DISPLAY.md)
for the system-table boundary and fallback rules. Container and actor rows
remain private; the pebble is publicly named only while visible on the floor.

The character starts at `(4, 4)`. The crate at `(6, 4)` contains one generic
workshop token. Its sparse owner-list slot is `3`; its item UI location is `7`.
Those numbers intentionally differ. The unlocked door at `(8, 4)` supplies a
position/door checkpoint witness alongside the token's ownership. Floor tiles
occupy `(1, 1)` through `(12, 10)`; the rest of the sector is void.
The separate crate at `(3, 7)` holds a standalone key in owner-list slot `3`.
The key has ID `7001` and item UI location `0`; it matches the locked door at
`(10, 6)` and the locked crate at `(6, 8)`. That third crate holds the keepsake
in owner-list slot `3`, with item UI location `0`. The actor still starts with
an explicitly empty inventory. A loose pebble at `(4, 7)` supplies the separate
ground-item witness, with no owner, owner-list slot or inventory flag initially.
The stationary Workshop guide at `(9, 8)` offers the quest **A closer look**.

```sh
node examples/inventory-workshop/generate.cjs
OPENARCANUM_MODULE=inventory-workshop npm start
```

Inspect the crate through native map input or the Containers panel. The server
chooses the approach and returns the token privately. Select **Take** to move the
whole Generic item into the private actor inventory. The same item moves from
crate owner-list slot `3` to the actor's lowest unused slot `0`. Select **Put** on
the actor's item to place it in the selected freshly inspected crate, then
**Take** to retake it. Both directions use the destination's lowest unused slot:
crate `3` → actor `0` → crate `0` → actor `0`. The stable ID and item UI location
`7` stay unchanged, and there is still one token. Transfers require a fresh
inspection and verified actor inventory. Stale or repeated requests cannot grant
another copy. The engine also permits Put into another known container that was
eligible in the fixed initial ownership universe and remains accessible,
followed by retaking from that destination. Reviewed locked sources can enter
that universe through attainable matching keys; actual access still requires a
currently held key.

**Take All** takes the crate's entire nonempty contents in one transaction. It
requires the same fresh inspection, known actor inventory, range, lock, pause and
busy checks as Take. Every item must be a supported whole Generic or standalone
Key instance; Key transfer requires an actor without a keyring. One
unsupported item or insufficient owner-list capacity rejects the entire batch.
The server chooses items in sparse slot/ID order and fills the actor's lowest
free slots, including holes. It creates no items and never skips or partially
takes contents. Item IDs and contents remain private to the requesting owner.
The three crates supply token, key and locked-keepsake loops; temporary core/socket
fixtures exercise multi-item batches, mixed unsupported contents and rollback.

Inspect the key crate, then **Take** its **Key** or choose **Take All**. Use the
locked door through native input or the Doors panel. The request names only the
door; the authority resolves a verified possessed matching key before approach
and again on arrival. Opening does not consume the key or clear `Locked`.
An already open supported door can be closed without the key. Put the key into
an eligible freshly inspected crate and retake it to repeat the loop.

With the key held, inspect the locked crate at `(6, 8)` and **Take** or
**Take All** its keepsake. **Put** it back and retake it through the same private
transfer controls. The lock flag and key remain unchanged. Put the key into an
unlocked crate: later use, inspection and transfer requests to the locked crate
reject until a matching key is held again. Access is checked before approach,
on arrival and for every private inspection or transfer; a previous inspection
does not grant permanent access. An authorized Put can place the sole key into
the locked crate itself, leaving it inaccessible without another matching key.

The authored locked door and crate opt in through `Portal.keyUseSupported: true`
and `Container.keyUseSupported: true`, respectively. Their lock fields are
`Portal.keyID` and `Container.keyId`. The old converter discarded script
attachments, so imported targets cannot acquire key support from missing
metadata. Matching rejects ID `0`, treats ID `1` on
either side as a master match, and otherwise requires equality. Keys retain
their immutable positive IDs and the conservative **Key** label. See
[Matching keys](../../docs/KEYS.md) for the boundary; keyrings, party sharing,
lock picking and original scripts remain unfinished.

Use the **Workshop pebble** to approach it, then choose **Pickup**. The same
instance enters the actor's lowest unused owner-list slot and disappears from
public ground state. Its **Drop** action places it at the actor's current tile;
pick it up again to repeat the loop. Drop rejects a tile containing another
ground item, and stale or repeated requests cannot create copies. Only this new
Generic item opts in through `Item.groundTransferSupported: true` and has owned
Item artwork. The token, keepsake and Key retain their existing rules and cannot
be dropped. The actor's inventory UI location remains unchanged as development
metadata. Junk piles, decay, throwing and original pickup/drop scripts are
unfinished. See [Ground items](../../docs/GROUND_ITEMS.md).

Talk to the **Workshop guide** and select **I will find the pebble** to accept
**A closer look**, or **Not now** to leave without accepting. Reopening an active
conversation gives a reminder. Pick up the pebble and return while holding it:
**Here is the workshop pebble** is available only for the verified item in the
actor's current inventory. Selecting it completes the quest and its private
journal entry. The pebble remains yours. Completion grants **2,100 XP** once,
raising the owned actor from level 1 / 0 XP / 5 unspent CP to
level 2 / 2,100 XP / 6 unspent CP. Declining, accepting, reopening dialogue and
repeated completion do not award XP. The private character panel displays
committed experience, level, banked points and the next cumulative threshold.
There are no point purchases or item rewards yet.
A pebble on the ground or in a crate does not qualify, and stale replies cannot
bypass the server's condition. After completion the guide thanks you and offers
a closing reply.

The generated `rules/Conversations.json` describes this bounded three-stage
conversation and journal. Only the guide's explicit
`Npc.conversationSupported: true` and matching `Npc.conversationId` opt into it.
The guide has distinct ochre Stand artwork and no active AI schedule or accessible
inventory. Dialogue and journal state are private; public target descriptors
carry only the guide's label and location. This adds no original DLG or script
interpreter. The actor explicitly opts into its separate progression ledger via
`Critter.progressionSupported: true` and fixed `rules/Progression.json`; the
quest declares `rewardExperience: 2100`. Original Bates character fields do not
opt into this authored policy. See [Owned dialogue and quests](../../docs/DIALOGUE_QUESTS.md)
and [Character progression](../../docs/PROGRESSION.md).

**Save checkpoint** stores actor position, managed doors and supported item
ownership, including the pebble's floor/held state and ground location, plus the
owned quest journal and XP/level/unspent CP. Save
before pickup and load after taking to restore it to the floor; save while held
and load after dropping to restore actor ownership. Save before taking, take the
token, then load to restore it to the crate's original slot `3`; save after taking
to restore it to the actor instead.
Save after putting back to restore the crate's new slot `0`. The server validates
the known owners, complete item set, counts, reciprocal parent links and supported
sparse slots before applying a load. Legitimate holes left by transfers are
preserved. Movement, local pause and checkpoints use the same authority as
the retail-data scene. Original Bates locks and its unknown actor inventory are
unchanged.
After opening the key door, a checkpoint can also restore its open state with
the key put away. Validation uses the fixed verified attainable key universe;
opening a closed door still requires current possession. The same checkpoint
can restore the keepsake's supported ownership with the key put away; the locked
crate remains locked and inaccessible. The initial attainable-source closure
cannot bootstrap a key behind its own lock or a disconnected key cycle.
Active and completed quest states and their exact earned progression also
survive load and fresh-host restore;
transient conversations close and must be reopened. Completed status does not
require continuing to hold the pebble afterward. Loading the earlier active
quest restores its earlier progression too, so completion can award once in
that restored state. Inconsistent quest/character values reject the whole load.

This narrow slice does not implement equipment, stacks, weight/capacity,
keyrings, retail ground transfers, barter, attribute purchases or unrestricted
transfers. XP saturates at 1,300,000 / level 50 as an explicit development
policy; banked CP is bounded at 56. Original cap-edge behavior is unverified. It does not
complete the M2 roleplaying slice or supply complete campaign saving.

`module.json` is fixed metadata for this example, rather than a general mod
loader or a source of executable rules. `Map.json` declares the validated start
location. The historical actor filename `16086.json` remains an engine adapter;
its actual owned prototype is `900001`, with an explicitly empty inventory.

The 89 generated files include readable JSON and PNG files alongside three
deterministic ZIP catalogs. Existing asset enumeration uses these catalogs;
loose files take precedence when loading their contents. Regenerate all outputs
after editing the generator so the catalogs and manifest stay consistent.
Critter and object metadata selects real PNG sprite sheets through
`imageExtension: "png"`; tile frame keys retain the legacy `Sprite.gif` key
convention while referring to frames in the actual `tiles.png` atlas.

Module-specific runtime saves and reports belong under ignored `local-data/`,
outside this checked-in example. Neither the example source nor generated
archives should change when a session is played. The default manual slot is
`local-data/saves/inventory-workshop.json`. Current checkpoints use schema 5
and rules `movement-doors-ownership-progression-v8`; only this current contract is
accepted. Startup does not auto-load the manual slot. Description text remains
outside simulation identity. This is not complete original-game take-all
behavior for retail loot, corpses, equipment or weight.
