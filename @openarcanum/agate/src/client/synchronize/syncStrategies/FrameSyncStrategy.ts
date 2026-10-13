import type ClientNetwork from '../../network/ClientNetwork'
import type { SyncOptions, SyncBatch, LegacySyncEngine, LegacyInput } from '../LegacySyncTypes'
import SyncStrategy from './SyncStrategy'

const defaults = {
  worldBufferLength: 60,
  clientStepLag: 0
}

export default class FrameSyncStrategy extends SyncStrategy {
  declare gameEngine: LegacySyncEngine
  declare needFirstSync: boolean


  constructor(clientEngine: ClientNetwork, inputOptions: SyncOptions) {
    const options = Object.assign({}, defaults, inputOptions)
    super(clientEngine, options)

    this.gameEngine = this.clientEngine.gameEngine as LegacySyncEngine
  }

  // apply a new sync
  applySync(sync: SyncBatch, required: boolean) {
    this.needFirstSync = false
    this.gameEngine.trace.debug(() => `framySync applying sync`)
    const world = this.clientEngine.world

    for (let ids of Object.keys(sync.syncObjects)) {
      let ev = sync.syncObjects[ids][0]
      let curObj = world.getDynamicEntity(ev.objectInstance.id)
      if (curObj) {
        curObj.syncTo(ev.objectInstance)
      } else {
        this.addNewObject(ev.objectInstance.id, ev.objectInstance)
      }
    }

    // destroy objects
    const entities = world.getDynamicEntities()
    for (let [id, entity] of entities) {
      let objEvents = sync.syncObjects[id]

      // if this was a full sync, and we did not get a corresponding object,
      // remove the local object
      if (
        sync.fullUpdate &&
        !objEvents &&
        Number(id) < this.gameEngine.options.clientIDSpace
      ) {
        this.gameEngine.removeDynamicEntityFromWorld(id)
        continue
      }

      if (!objEvents || Number(id) >= this.gameEngine.options.clientIDSpace) {continue}

      // if we got an objectDestroy event, destroy the object
      objEvents.forEach((e) => {
        if (e.eventName === `objectDestroy`)
          this.gameEngine.removeDynamicEntityFromWorld(id)
      })
    }

    return this.SYNC_APPLIED
  }
}
