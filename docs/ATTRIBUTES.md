# Owned attribute purchases and derived previews

The [inventory workshop](../examples/inventory-workshop/README.md) lets the
controlled actor permanently raise its eight base attributes. Each **+1** costs
one unspent Character Point. Strength, Dexterity, Constitution, Beauty,
Intelligence, Perception, Willpower and Charisma start at eight and cannot be
purchased above twenty. There is no refund, decrement or respec in this slice.

Spend the five starting points, accept [A closer look](DIALOGUE_QUESTS.md) and
show the held pebble to earn one more point through its level-up. Spend that
point too. The server commits each purchase and its point deduction together;
the private character panel shows the resulting attributes and derived
values. Carry capacity now enforces inventory actions; other derived values
remain previews. Save while the quest is active or after completion, change a
purchase, then load to restore the saved build and budget.

## Fixed neutral profile

`rules/Progression.json` version 2 selects `profile: "neutral-human"` for the
explicitly opted-in owned actor. Its fixed baseline is level 1, zero XP, five
unspent points and eight in each attribute. This profile has no racial, gender,
background, equipment, training, poison or spell effects, and zero purchased
HP/fatigue points and adjustments. It is separate from `Critter.stats` and does
not initialize imported actor or NPC statistics.

These boundaries make a specific purchase loop testable. They do not implement
the original character editor, racial caps, skill/spell prerequisites or the
complete effect system. Intelligence and Perception purchases persist, but
their future skill, dialogue and perception rules are not supplied by the ten
previews below.

## Reviewed derived values

The following calculations use the owned effective attributes, which equal its
base attributes in this neutral profile. Integer division truncates toward zero;
positive divisions below are equivalent to floor. Final stat bounds still apply.

| Private field | Neutral calculation | All attributes 8, level 1 |
| --- | --- | ---: |
| `maxHealth` | `WP + 2 × (ST + level) + 4` | 30 |
| `maxFatigue` | `WP + 2 × (CN + level) + 4` | 30 |
| `carryWeight` | `500 × ST`, bounded to 300–10,000 stone | 4,000 stone |
| `damageBonus` | `ST − 10`; divide negative results by 2; double at ST 20 | −1 |
| `armorClassAdjustment` | `DX − 10`, bounded to −9–95 | −2 |
| `speed` | `DX`, plus 5 at DX 20, bounded to 1–100 | 8 |
| `healRate` | `(CN + 1) / 3`, bounded to 0–6 | 3 |
| `poisonRecovery` | `CN`, bounded to 1–20 | 8 |
| `reactionModifier` | Beauty lookup; BE 20 gives 100; bounded to −65–200 | −7 |
| `maxFollowers` | `CH / 4`, bounded to 1–7 | 2 |

Important boundaries include ST 9 damage **0**, rather than −1; CN 20 heal rate
**6**, rather than 7; DX 20 speed **25**; and BE 20 reaction **100**, rather
than the ordinary lookup's final entry. Level 2 raises the neutral HP and
fatigue previews to 32 even without an attribute purchase. Raising ST from 8
to 9 raises HP by two and carry capacity by 500 stone; raising WP from 8 to 9
raises both HP and fatigue by one.

The Beauty lookup for values 1–19 is
`[-65,-52,-42,-33,-25,-18,-12,-7,-3,0,3,7,12,18,25,33,42,52,65]`.
The [manual glossary, physical PDF page 115](../local-data/reference/manual/manual.html#page-115),
defines ten stone as one pound.
Original inventory code displays its integer weights directly in stone; the
preview therefore reports 4,000 stone, without an invented conversion factor.

The [carrying-capacity rule](WEIGHT.md) now uses `carryWeight` for Take, Take All
and Pickup on the supported owned actor. Strength purchases immediately change
the private load view and incoming weight limit. Checkpoints preflight ownership
against the saved, replayed Strength. The remaining values are **derived previews**;
combat, movement, healing, poison, social and follower systems remain ahead.
The current fixed movement clock and legacy health method are unchanged.

## Authority and checkpoints

A purchase names one allowed attribute and a fresh world revision. The server
checks support, points, cap, pause, movement, other pending actions and current
ledger consistency. Stale, replayed, malformed or unaffordable requests reject
without changing either the attribute or CP. The client displays committed
responses and cannot supply a desired value or point cost. Character attributes
and derived previews stay private to the owner.

Current checkpoints use schema 6 and
`movement-doors-ownership-attributes-weight-v10`. They persist the purchased attributes
and an ordered history of completed-quest rewards and purchases. Loading replays that
bounded history from the fixed baseline and requires its final attributes,
budget, XP, level and quest states to match before restoring any world state.
It preserves order because the 56-point CP bank can discard a grant at its cap:
spending before or after a capped grant can produce different valid budgets.
A purchase before its points were available or an inconsistent final value
rejects the whole load. History is checkpoint validation data, outside public
snapshots and private dialogue text.

Only the current development contract is supported. Complete character
creation, bought HP/fatigue, skill/spell/discipline spending, equipment/effects,
refunding and original campaign advancement remain unfinished; M2 remains open.

## Primary evidence

All CE links identify the locally inspected revision
`36cd712d135bfb76fa6d0ede6803d521a2b391f7`:

- [Primary defaults and bounds](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L43) establish base values and neutral human caps; [race-specific maxima](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L905) explain the excluded profiles.
- [Costs](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L151) and [editor purchases](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/ui/charedit_ui.c#L1392) check limits and available CP before committing the increase and deduction.
- [Derived formulas](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L554), [Beauty lookup](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L179) and [effective clamps](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/stat.c#L513) distinguish raw formulas from displayed values.
- [Maximum HP](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/object.c#L1632) and [maximum fatigue](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/critter.c#L502) include level, purchased points, adjustments and effects; this profile fixes the latter three to zero/none.
- [Inventory weight display](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/ui/inven_ui.c#L2998) uses integer stone values. [Original weight enforcement](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L3639) is outside the current preview.

The supplied manual, physical PDF pages 15 and 17–20, describes point purchases,
human averages, exceptional attributes and derived statistics. Original files,
page images and detailed research stay private under `local-data/`.
