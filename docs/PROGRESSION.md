# Owned character progression

The [inventory workshop](../examples/inventory-workshop/README.md) now connects
its [guide quest](DIALOGUE_QUESTS.md) to authoritative experience, level and
banked Character Points. Completing **A closer look** grants **2,100 XP** once:
without prior purchases, the actor moves from **level 1, 0 XP, 5 CP** to
**level 2, 2,100 XP, 6 CP**. The same earned point can now fund an
[owned attribute purchase](ATTRIBUTES.md).
The pebble remains owned by the actor. Accepting, declining, reopening dialogue,
invalid replies and repeated completion requests award nothing.

This is an explicitly authored reward chosen to exercise the first level-up.
It is not an original quest reward or a claim about the balance of the original
campaign. The neutral owned profile now supports eight permanent base-attribute
purchases and ten derived previews. Skills, spells, technological disciplines,
complete derived-stat effects, character creation and auto-level schemes remain
unfinished.

## Rules and source evidence

The inspected arcanum-ce revision is
[`36cd712d135bfb76fa6d0ede6803d521a2b391f7`](https://github.com/dutch/arcanum-ce/tree/36cd712d135bfb76fa6d0ede6803d521a2b391f7).
Its [level table loader](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/level.c#L268)
reads cumulative minimum XP by level and fixes level 1 at zero. The locally
supplied original `rules/xp_level.mes` and converted `ExperienceLevel.json`
agree on these numeric thresholds:

| Level | Minimum XP | Level | Minimum XP |
| --- | ---: | --- | ---: |
| 1 | 0 | 26 | 257,900 |
| 2 | 2,100 | 27 | 280,600 |
| 3 | 4,600 | 28 | 304,600 |
| 4 | 7,700 | 29 | 330,000 |
| 5 | 11,400 | 30 | 356,800 |
| 6 | 15,500 | 31 | 385,100 |
| 7 | 20,300 | 32 | 414,900 |
| 8 | 25,600 | 33 | 446,300 |
| 9 | 31,600 | 34 | 479,500 |
| 10 | 38,300 | 35 | 514,300 |
| 11 | 45,600 | 36 | 551,000 |
| 12 | 53,600 | 37 | 589,500 |
| 13 | 62,400 | 38 | 630,000 |
| 14 | 71,900 | 39 | 672,500 |
| 15 | 82,200 | 40 | 717,100 |
| 16 | 93,300 | 41 | 764,000 |
| 17 | 105,300 | 42 | 813,100 |
| 18 | 118,200 | 43 | 864,600 |
| 19 | 132,000 | 44 | 918,500 |
| 20 | 146,700 | 45 | 975,000 |
| 21 | 162,500 | 46 | 1,034,200 |
| 22 | 179,300 | 47 | 1,096,200 |
| 23 | 197,200 | 48 | 1,161,100 |
| 24 | 216,300 | 49 | 1,229,000 |
| 25 | 236,500 | 50 | 1,300,000 |

[Character Point grants](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/level.c#L432)
are one per newly attained level, plus one extra when that level is divisible by
five. A gain spanning several levels receives every applicable grant. Original
[defaults](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L115)
are level 1, zero XP and five unspent points. The reviewed
[stat maximum](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L79)
and [setter](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L650)
bound banked points at 56. The ledger adds each level grant to the current bank,
clamps at that bound and deducts one point per committed attribute purchase.
Ordered history preserves the distinction between spending before or after a
grant that reaches the cap.

Physical manual pages 21 and 23 describe XP-based advancement, Character Points
and a maximum playable level of 50. The original level file includes an extra
row 51 at 1,380,000 XP, while its header identifies levels 1–50 as valid. The
reviewed CE [cap branch](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/level.c#L492)
uses that sentinel without storing level 51. Its exact cap behavior has not
been verified against the reference executable. OpenArcanum therefore uses the
explicit **development policy** of saturating XP at 1,300,000 and level at 50;
there is no next-level target at the cap. This is not a claim of original
cap-edge fidelity.

Original [quest completion](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/quest.c#L366)
rejects repeated terminal transitions and can award XP. Original
[XP delivery](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/critter.c#L1837)
also applies difficulty and effect modifiers. The owned reward uses its declared
amount without difficulty, effect, follower or party adjustments.

## Authoring, authority and persistence

The owned actor explicitly declares `Critter.progressionSupported: true`.
`rules/Progression.json` version 2 binds the fixed actor ID `16086.json` to
`profile: "neutral-human"`, baseline XP zero, level one, five unspent points and
eight in each of the eight attributes. The document does not customize the
curve or execute code. The guide's quest definition declares
`rewardExperience: 2100`; definitions without this field have no XP reward.
Reward values are safe integers from zero through 2,000,000,000, bounded by the
reviewed XP stat maximum. A positive reward cannot
complete for an unsupported actor: the command rejects instead of silently
discarding the reward.

Progression lives in a server ledger, separate from `Critter.stats`. An imported
actor does not opt in merely because converted XP/level fields exist. Original
Bates progression and unknown character semantics are not initialized or
rewritten. The actor's private character view contains XP, level, unspent CP and
the cumulative next-level threshold, permitted attribute rows and ten neutral
derived previews. Public observer snapshots and command summaries omit those
values.

Quest completion and its XP/level/CP update commit together or reject together.
The client displays committed state; it cannot choose XP, a level or a point
grant. Current checkpoints use schema 7 and
`movement-doors-ownership-attributes-weight-scripts-v11`. The exact character record is
`{experiencePoints, level, unspentPoints, attributes, history}`, or `null` when
unsupported. Loading replays the bounded ordered quest/purchase history from
the fixed baseline, checking caps, available points and each once-only reward.
Its final attributes, budget, XP, level and quest states must match before
restoring quest status, actor position, doors and supported ownership together.
A forged point count, a purchase before its points were earned or an
inconsistent reward state rejects the whole load. Derived previews are
recomputed and are not stored as independent mutable statistics.
Restoring an earlier active-quest checkpoint also restores its earlier XP; a
later completion grants the reward once in that restored state.

This limited checkpoint has no complete campaign progression, respec, combat
XP, scripted reward API, difficulty policy or shared party XP. Purchases and
derived previews do not bind the current movement, combat, health or inventory
weight rules; [Attributes](ATTRIBUTES.md) describes that boundary. M2 remains
unfinished. Private primary-source and original-data evidence is recorded under `local-data/research/progression/`.
