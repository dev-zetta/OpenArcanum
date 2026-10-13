# Owned conversation and quest

The [inventory workshop](../examples/inventory-workshop/README.md) includes a
stationary **Workshop guide** at `(9, 8)` and the small quest **A closer look**.
This is a data-driven local-authority slice. Original dialogue files, script
attachments and campaign quests are not executed by it.

## Player scenario

Approach the guide and talk. **I will find the pebble** accepts the request and
creates an active private journal entry. **Not now** leaves without accepting.
Talking again while active gives the reminder and a closing reply.

**Here is the workshop pebble** is offered only when the controlled actor's
verified inventory currently owns the exact workshop pebble. A pebble on the
floor or in a crate does not satisfy this condition. The server rechecks the
condition when the reply is selected, so an old displayed choice cannot complete
the quest after the item is dropped or put away. Showing the pebble completes
the quest without consuming it, transferring it or creating an item. The same
transaction grants its authored **2,100 XP**, advancing the owned actor from
level 1 / 5 unspent CP to level 2 / 6 unspent CP when none were spent.
If the five starting points were already spent, it grants the one newly earned
point for another [attribute purchase](ATTRIBUTES.md). This reward happens once; see
[Owned character progression](PROGRESSION.md). Later conversations use the
completed greeting and a closing reply.
Completion is terminal in this slice.

The journal records active/completed status independently of whether the pebble
is still held afterward. Dialogue choices and journal state remain private to
the authorized owner. Public snapshots expose only the guide's label, location
and supported interaction; observers do not receive the conversation or quest.

## Data and authority

The generator authors `rules/Conversations.json` with a versioned, bounded
declarative schema. Each quest has stable ID, title and active/completed journal
text. Each conversation names one NPC and quest and has exactly three stage
nodes: `offer`, `active` and `completed`. Options use only `start`, `complete` or
`close`; completion requires a `held-item` condition referencing a supported
immutable item ID. There is no executable code, arbitrary expression evaluator
or general dialogue language.

The authored NPC declares `Npc.conversationSupported: true` and the matching
`Npc.conversationId`. Missing converted script metadata never opts an imported
NPC into this policy. The guide has distinct procedural Stand artwork and no AI
schedule, combat behavior, follower rules or accessible inventory.

The server chooses the approach and rechecks target presence and cardinal
range. Replies are bound to the current private conversation, offered option,
quest stage and world revision. Stale, replayed, out-of-range or ineligible
requests reject without a quest transition or item mutation. Movement, pause,
load, stop and other invalidating actions discard the transient conversation;
the client refreshes the private view instead of deciding a quest outcome.

Current checkpoints use schema 7 and
`movement-doors-ownership-attributes-weight-scripts-v11`. They restore the validated quest journal
and its XP/level/unspent CP, attributes and ordered purchase/reward history
with actor position, doors and supported ownership
in one load. A reward inconsistent with the saved quest states rejects the load.
Conversation sessions and displayed replies are transient and must be reopened after load.
Only the current contract is supported; this is still a limited development
checkpoint rather than complete campaign persistence.

## Original evidence and remaining work

The locally supplied manual, physical PDF pages 66–67, describes creature-click
conversation, player-selected replies, closing statements and options filtered
by character traits, items or quest state. Page 44 describes quest-log states.
The inspected arcanum-ce sources support those distinctions:

- [Dialogue start and reply processing](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/dialog.c#L471) check whether the NPC can speak before beginning and again before a selected action.
- [Option filtering](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/dialog.c#L1310) includes gender, intelligence and further conditions.
- [Quest and inventory conditions](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/dialog.c#L1484) test original quest state and inventory; original inventory lookup can also include followers.
- [Quest effects](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/dialog.c#L1958) invoke the original quest state setter.
- [Original state transitions](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/quest.c#L366) reject downgrades and repeated terminal changes and can award experience.
- [Talk reach](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/anim.c#L7988) uses the original distance policy; cardinal reach one is this engine's narrower development rule.

The current exact-item condition, three stages, fixed XP reward and private
one-actor journal are deliberate boundaries. Original `SAP_DIALOG` execution,
DLG syntax,
intelligence/skill/reaction checks, persuasion, rumors, failure/unbotch states,
timestamps from world time, original quest reward rules, speech, follower
substitution and co-op conversation ownership remain future work. The complete M2 roleplaying
slice remains unfinished.

Primary-source and manual evidence remains private under
`local-data/research/dialogue-quests/`.
