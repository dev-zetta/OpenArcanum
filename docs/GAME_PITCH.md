# OpenArcanum: a world of magick, machines and consequences

**Product vision and implementation proposal, October 13, 2026.** This describes the game we intend to build. Current development includes the [local Bates Mansion checkpoint](DEVELOPMENT.md) and an [owned inventory workshop](../examples/inventory-workshop/README.md). A finished campaign, co-op game and MMORPG service remain targets.

## The promise

Build a character, choose a way through the world, and live with what follows. Become a persuasive diplomat, a burglar, a gunsmith, a battle mage, or an awkward combination of all four. A conversation, a stolen key, a handmade device and a sword should be different, consequential answers to the same problem.

OpenArcanum aims to preserve the distinctive roleplaying systems of *Arcanum: Of Steamworks and Magick Obscura* in an independent, inspectable engine. Its world is changing under industrialization: established magick and new technology interfere with one another, and those tensions reach into equipment, professions, travel and social life. Character identity matters beyond combat; intelligence, reputation, training and relationships should open and close possibilities. These are original design pillars, documented in the manual's [introduction](../local-data/reference/manual/manual.html#page-003), [character systems](../local-data/reference/manual/manual.html#page-008) and [gameplay rules](../local-data/reference/manual/manual.html#page-039).

The new opportunity is to make that world playable alone, with friends, and eventually through community-hosted persistent worlds, using one authoritative simulation. Mods should be able to add a workshop, a quest, a profession or an entire campaign without replacing the engine.

## What the player does

The core loop is **explore → learn or negotiate → prepare → act → face consequences → develop the character**. Combat is one route through this loop. Dialogue, stealth, social skills, technological invention and companions must be useful routes too.

The first complete experience is deliberately small: create a character, enter a real map, take an item from a container, equip or use it, resolve a conversation and quest, survive one encounter, travel away and return, then reload a save with every consequence intact. That sequence becomes the foundation for the original campaign and new authored modules. The [feature roadmap](FEATURE_ROADMAP.md) defines how we prove each part.

## One engine, three ways to inhabit it

| Mode | Intended experience | Authority and persistence |
| --- | --- | --- |
| Singleplayer | A private campaign with original roleplaying depth, pause and save slots. No internet account required. | The desktop application starts a local authoritative server and connects its client through the same versioned protocol used online. The server owns the save. |
| Co-op | A small party sharing a campaign, discoveries and difficult decisions. Proposed first target: 2–4 players. | A listen host or dedicated server owns the world. Players reconnect to their characters; quest choices, loot, travel and dialogue have explicit shared-world rules. |
| Persistent community world | A module that stays alive between sessions, with server-defined progression, economy and social rules. | A headless dedicated server owns long-lived state and chooses its module and policies. Higher population targets follow measurement and operational work. |

The architecture is **MMORPG-oriented**: authoritative entities, persistent state, module-defined worlds, player sessions and eventual interest-based replication. That is a direction for the engine, not a claim that today's prototype supports MMO populations. We will first prove the same rules in local singleplayer and a small co-op session.

The original manual already describes server/client multiplayer modules, parties and configurable host rules ([PDF pages 104–113](../local-data/reference/manual/manual.html#page-104)). Full original-campaign co-op, a common singleplayer/server architecture, and persistent community worlds are OpenArcanum design choices. They require explicit answers where the original singleplayer and multiplayer rules differ.

## Built for authors and different machines

The target clients are Windows, Linux and macOS; dedicated servers should run without Electron or a graphics device. Electron provides the current desktop shell, while AGate supplies the game systems. The rendering client and UI must remain replaceable consumers of world state, rather than the owners of game rules.

Modding starts with documented, versioned data: stable content identifiers, manifests, dependency and load-order checks, validation, and saves that record their module versions. Trusted server logic and presentation extensions need separate APIs. An untrusted downloaded mod must not inherit the current renderer's Node privileges. Original game data remains a separate, locally supplied content layer; engine code, authored test modules and redistributable mod content can travel independently.

The first owned example is the Inventory workshop: a small map, character,
accessible token and key crates, a locked keepsake crate, items and doors, with a deterministic
generator for its data and PNG artwork. A stationary guide supplies one small
conversation and quest. It runs without an original game
installation and shares the local
server/client path. Its fixed metadata manifest and data-defined spawn begin the
authoring foundation; general mod loading and supported extension APIs are still
future work.

## The standards we will hold it to

- **Roleplaying depth:** preserve the interplay of magick and technology, character creation, social reactions, quests, followers, combat, invention and discovery. A working window is not a working rule system.
- **Visible evidence:** compare named scenarios with a locally running reference game. The reference-game harness is our “oracle”: repeatable actions and observations, not an AI model or a substitute rules engine.
- **Shared authority:** a client requests actions; the server validates costs, permissions and consequences. Singleplayer uses that boundary too.
- **Author freedom:** ship a small original test module and the tools to build another. Document extension points and failure messages before claiming an integrated editor.
- **Sustainable delivery:** finish playable slices, then expand content and concurrency. Publish measured compatibility and platform results instead of an unsupported completion percentage or launch date.

## Where we stand

The current JavaScript/Flow engine builds in a modern Electron/Ember/PixiJS shell. With compatible local converted assets it renders nine Bates Mansion sectors, animates a controlled actor, rejects blocked movement, handles recovered roofs, and applies original static light masks with ground-sampled object colors. The desktop starts an owned headless Node child on a private loopback port. That host loads its own map geometry and prototypes, validates versioned movement and door-use commands, rejects unauthorized or replayed actions, and advances movement on its own clock. Supported doors can be approached, opened and closed, with collision and committed original art poses replicated to the client. The client interpolates movement snapshots for presentation. Server-controlled local pause freezes movement and world animation without interrupting pending actions; idle checkpoints remain available.

Recovered original inventory links support server-controlled container approach
and private inspection. The engine now also supports taking whole Generic items
and standalone Keys into a verified actor inventory, putting them into a verified attainable container
with current access, and retaking them from that destination. Both
directions require a fresh inspection revision. Original Bates nonempty
containers stay locked, and its separate controlled-actor
template still has unknown inventory; neither is changed to enable this slice.
Atomic Take All extends the same guarded path to a nonempty container whose
entire contents are supported whole Generic or standalone Key items. Key transfer
requires a known actor inventory without a keyring and an immutable positive key
ID. The host chooses sparse slot/ID order and fills the known actor's lowest
free slots. An unsupported item
or insufficient owner-list capacity rejects the entire batch: no skipped items,
partial transfer or newly created items. Contents and transferred IDs stay in
the requesting owner's private response, outside public observer state.
Private item labels now use [system descriptions with identification-aware
fallback](ITEM_DISPLAY.md). Missing unknown text cannot reveal an identified
name. The workshop explicitly names its token, keepsake and pebble; module-specific/key names,
identification services and full examination remain unfinished.
One manual checkpoint using schema 5 saves position, managed doors, supported
reciprocal item ownership, the owned quest journal and its XP/level/unspent CP. Current rules
`movement-doors-ownership-progression-v8` validate the known owners,
complete item set, reachable sparse slots and consistent quest/progression states before applying
a load, including legitimate holes left by Put; unknown original metadata remains untouched. Only the
current schema 5/rules v8 contract is accepted. An authored key door can restore
an open pose after the key is put away when the fixed verified attainable key
universe establishes that state.

The owned workshop supplies a second content path with no retail assets. Its
actor starts with an explicitly empty inventory, and its accessible crate holds
one item instance with stable identity and reciprocal ownership links. Players
can walk, inspect the crate privately, take its token individually or with Take
All, put it back, retake it, view their private actor inventory, pause, and
save/reload supported ownership alongside position and doors. Both transfer directions choose the destination's
lowest unused owner-list slot: crate `3` → actor `0` → crate `0` → actor `0`.
The same item's separate UI location remains `7`, its identity is stable and the
token count stays one.

The workshop's 89 generated files include a separate key crate at `(3, 7)`,
a locked door at `(10, 6)` and a locked keepsake crate at `(6, 8)`. Take its
standalone key `7001`, then use the door and retrieve the **Workshop keepsake**.
The authority chooses a matching possessed key before approach and again on
arrival; requests name only the target. Container inspection and each transfer
recheck current possession. These per-command checks are an authority policy;
original container authorization happens when its inventory UI opens. ID `0` never matches, ID `1` on
either side is a master match, and other positive IDs must be equal. Opening
consumes no key and leaves the lock set; an already open supported door can be
closed without the key. Put the key into an eligible container and retake it to
repeat the loop.

This is explicitly authored support: `Portal.keyUseSupported: true` or
`Container.keyUseSupported: true` is mandatory because the old converter discarded
original script attachments. Original Bates locks are not opted in. A fixed chain
of attainable keys and containers constrains transfers and checkpoint ownership;
a key cannot authorize its own retrieval from a locked source, and inaccessible
key cycles remain blocked. Putting a key away does not invalidate saved ownership.
Unsupported lock flags remain rejected. [Matching keys](KEYS.md) describes this
small rule set; rings, party sharing, original key names, picking and script
execution remain future work, alongside equipment, stacks, weight/capacity,
junk piles, decay, barter and unrestricted transfers. A separate authored Generic
pebble at `(4, 7)` supplies the first [ground pickup/drop loop](GROUND_ITEMS.md),
with procedural artwork, server-owned placement and held/ground checkpoints.
Container Put/Take preserve its identity. The token, keepsake and key are not
opted into ground actions. Single-item tiles, no portal placement and preserved
item UI location are development policies; original scripts, stacking and grid
packing remain unfinished.
The workshop supplies token, key and locked-keepsake UI loops; multi-item batches and
atomic rejection use temporary core/socket fixtures. This does not establish
complete retail looting, corpse inventory or original take-all behavior.

The **Workshop guide** at `(9, 8)` now offers [A closer look](DIALOGUE_QUESTS.md).
Accept the request, find the pebble and show it while carrying it. A bounded
data-only conversation chooses offer, active or completed replies from the
server's quest state. Showing the exact held item completes the private journal
entry without consuming or transferring it. The same transaction grants
**2,100 XP** once: the owned actor advances from level 1 / 0 XP / 5 unspent CP
to level 2 / 2,100 XP / 6 unspent CP. The private character view and checkpoint
carry that committed progression; repeat conversations cannot award it again. Dropping or
putting it away first makes that reply ineligible. Checkpoints preserve active
and completed state; completion persists after the pebble is put away, while
the transient conversation must be reopened after load. This authored scenario
does not execute original dialogue or script files, or implement social checks,
failure states, timestamps, original reward modifiers or shared-party quest rules.
[Progression](PROGRESSION.md) uses the verified XP curve and level CP grants,
with explicit XP saturation at 1,300,000 / level 50 and a bank of at most 56 CP.
Point purchases and their derived-stat effects remain unfinished.

This is the first local authority foundation: one controlled actor, a fixed development speed and read-only observer synchronization. It does not yet supply original world time, complete campaign saving, playable co-op or MMORPG operation. Original combat, dialogue/script execution, campaign quests, full inventory rules, character progression, followers, travel and campaign persistence remain substantial implementation work. M2, the complete roleplaying slice, remains open. Only Linux has been exercised in the current validation. The next success is a complete authoritative roleplaying slice, followed by a shared session that proves the same consequences to two controlled clients.

Manual links refer to the private local conversion and use physical PDF page numbers. That conversion and the original game's content are not part of the public source distribution. This pitch is an authored proposal; the [roadmap](FEATURE_ROADMAP.md) separates manual-derived baseline features from new product decisions.
