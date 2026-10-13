/** Dormant Realm integration: the active authority uses JSON checkpoints. */
export interface RealmSchema { name: string; properties: Record<string, string>; primaryKey?: string }
export interface RealmConfiguration { path: string; schema: RealmSchema[] }
export type RealmRecord = Record<string, unknown>
export interface RealmResults extends ReadonlyArray<RealmRecord> { filtered(query: string): RealmResults }
export interface RealmStore {
  write(callback: () => void): void
  create(name: string, value: RealmRecord, update: boolean): RealmRecord
  delete(value: RealmRecord | RealmResults): void
  objects(name: string): RealmResults
  objectForPrimaryKey(name: string, key: unknown): RealmRecord | undefined
}
export interface RealmProvider {
  open(config: RealmConfiguration): Promise<RealmStore>
  openSync?(config: RealmConfiguration): RealmStore
}
let provider: RealmProvider | undefined
function unavailable(): Error { return new Error('The legacy Realm database requires an explicitly configured Realm provider') }

export default class Realm implements RealmStore {
  declare private store: RealmStore
  static configure(next: RealmProvider | undefined): void { provider = next }
  static async open(config: RealmConfiguration): Promise<RealmStore> {
    if (!provider) throw unavailable()
    return provider.open(config)
  }
  constructor(config: RealmConfiguration) {
    if (!provider?.openSync) throw unavailable()
    this.store = provider.openSync(config)
  }
  write(callback: () => void): void { this.store.write(callback) }
  create(name: string, value: RealmRecord, update: boolean): RealmRecord { return this.store.create(name, value, update) }
  delete(value: RealmRecord | RealmResults): void { this.store.delete(value) }
  objects(name: string): RealmResults { return this.store.objects(name) }
  objectForPrimaryKey(name: string, key: unknown): RealmRecord | undefined { return this.store.objectForPrimaryKey(name, key) }
}
