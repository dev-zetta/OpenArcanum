# Legacy adapters

The playable local game uses `server/authority/AuthorityServer.ts`, owned Electron
child processes, converted assets and JSON checkpoints. It does not use the old
`server/ServerNetwork.ts` multiplayer draft, Realm, Google OAuth/YouTube, or
renderer-side Electron modal windows.

The TypeScript migration made these dormant paths explicit. Their presence does
not mean that the old multiplayer protocol, database, upload service or remote
window workflow is implemented or supported.

## Old multiplayer draft

`LegacyNetworkProvider` supplies authentication, input processing, optional world
creation and optional serialized updates. `ServerNetwork.start()` rejects before
opening a port when no provider is configured. The adapter retains the public
server entry points, queued inputs ordered by simulation step, world membership,
full/delta snapshot scheduling and idle cleanup.

The earlier draft referenced undefined players/worlds/rooms, confused a listening
socket with a connected peer, and iterated an entity map with `for ... in`.
Nonfunctional draft statements were replaced with typed integration points;
Git history retains the original source. This adapter is not the basis for new
co-op work: extend the active authoritative protocol instead.

## Realm

`libs/Realm.ts` defines a `RealmProvider` and the small schema, record, collection
and transaction interface used by `shared/realm`. Configure a real provider
before opening a database. Synchronous construction additionally requires
`openSync`. There is no empty database implementation or implicit SDK install.
The active engine continues to use its current asset/checkpoint data paths.

## Google services

`configureGoogleProvider()` accepts an OAuth client factory and the YouTube
methods consumed by the historical wrapper. SDK access is deferred until a
service operation is requested; absent providers produce an explicit error.
No SDK, authentication session or upload is started by importing these files.
OAuth credentials remain environment configuration, and invoking the historical
credential store still requires the caller's explicit service setup.

## Electron modal windows

Electron's removed `remote` module is no longer required. The historical modal
helper accepts an explicitly configured `ModalWindowProvider` supplied by a
privileged desktop host. The normal game window and current display-media
permission flow remain in the typed Electron host.

## Source and tests

Owned runtime source is checked with strict TypeScript settings. Historical
adversarial fixtures use a separate test configuration that allows inferred
fixture parameters and deliberately malformed objects. Runtime assertions,
real socket/process checks and native rendering smoke tests remain required;
loosening fixture inference does not loosen production source checks.
