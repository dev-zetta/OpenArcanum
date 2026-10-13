# Private item names

Inventory and container rows can resolve a permitted name from the converted
system description catalog. The headless server chooses the label; the client
receives it only through private inspection, inventory and transfer replies.
Public snapshots, observers and late joins contain no held inventory or container
contents. Explicitly supported visible ground items publish their permitted
label in floor descriptors; picking them up removes that public ID and name.

## Lookup rules

The source of a normal examined item name is `Base.descIndex`. `Base.nameIndex`
is a separate original object-name field and is not used as display text.
An item is identified when its explicitly known integer
`Item.magicTechComplexity` is zero or negative, or its flags contain `Identified`.
Otherwise the permitted description ID is `Item.descriptionUnknown`. Missing
or invalid complexity is treated conservatively unless `Identified` is explicit.
If the unknown description is missing, the known name is never substituted.

This slice reads only `mes/Description.json`, for IDs below `30000`. Module
`GameDescription` IDs are a separate namespace and retain a type label until
module selection is explicit. Keys require the separate original key-description
table; key-ring naming also remains conservative. Both retain their type labels. Effects, examination
statistics and an identification action remain unfinished.

The original lookup and identification branches are documented in the locally
reviewed [arcanum-ce object examination source](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/object.c#L3935),
[item identification predicate](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/item.c#L2285)
and [system/module description selection](https://github.com/dutch/arcanum-ce/blob/36cd712d135bfb76fa6d0ede6803d521a2b391f7/src/game/description.c#L123).
Original prototype bytes and converted Bates records were also compared locally;
that private evidence remains under `local-data/research/item-display/`.

## Catalog and fallback

Converted catalogs use `{ "Description": [{ "id": "9003", "text": "Workshop token" }] }`.
Older converters can emit an object keyed by row ordinal instead of an array.
In either shape, lookup uses each row's `id`, never its array index or object key.
Catalog loading is bounded to 1 MiB, 10,000 rows and 128 characters per label.
Malformed or ambiguous entries cannot become names. Missing, empty or oversized
labels fall back to the existing type label; no filename, prototype number or
visual-artwork name is guessed. Labels are bounded plain text and Ember escapes
them in both displayed rows and button accessibility labels.

Each host holds its own immutable catalog for the session. Text does not affect
collision, transfer eligibility, ownership signatures or item identity. Ownership
validation happens before presentation; labels do not authorize an item action.
The catalog is outside the raw simulation-content fingerprint, so a text-only
edit can rename displayed items after host restart without invalidating an
otherwise compatible ownership checkpoint. No hot reload or localization API
is implied. Text-only changes do not change the current checkpoint rules.

## Owned example

The [inventory workshop](../examples/inventory-workshop/README.md) explicitly
authors token description ID `9003` and keepsake description ID `9006`, both
with complexity `0`, and the system catalog entries **Workshop token** and
**Workshop keepsake**. A third row `9007` supplies **Workshop pebble**, also
with explicit complexity `0`. Its label is public while the authored item is
on the floor and private after pickup. The keepsake's name is returned only
after authorized access to its authored locked crate, or in the verified actor inventory after
transfer; naming does not bypass its matching-key access check. All readable
sources and deterministic ZIP catalogs remain redistributable. Its generator
now produces 89 data files, including the [standalone key scenarios](KEYS.md)
and [authored ground pickup/drop](GROUND_ITEMS.md).

The raw simulation fields remain part of the current content fingerprint;
description text is presentation only. Development saves are disposable and no
older-rule compatibility is maintained; the current checkpoint contract is
schema 5 with `movement-doors-ownership-progression-v8`. Original Bates records and unknown
controlled-actor inventory remain unchanged.
