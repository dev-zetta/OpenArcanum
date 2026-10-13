import type GameEngine from '../GameEngine'
import type EventEmitter from '../misc/EventEmitter'
import type System from './System'
import type AssetLoader from '../assets/AssetLoader'
import Entity, { type ComponentConstructor } from './Entity'
import Component from './components/Component'
import Components from './components'
import UID from './UID'
import Prototype from './Prototype'
import Utils from '../misc/Utils'
import EntityUtils from './Utils'
import Systems from './systems'
import ObjectPool from './ObjectPool'
import Messenger from './Messenger'
import { entityDocument } from './EntityData'

type ComponentToken = ComponentConstructor | string
interface EntityGroup { components: ComponentToken[]; entities: Entity[] }

export default class Manager {
  static ENTITY_CREATED = 'Manager#ENTITY_CREATED'
  static ENTITY_REMOVE = 'Manager#ENTITY_REMOVE'
  static COMPONENT_ADDED = 'Manager#COMPONENT_ADDED'
  static COMPONENT_REMOVE = 'Manager#COMPONENT_REMOVE'
  gameEngine: GameEngine
  updateCounter = 0
  lastUpdate = 0
  entities = new Map<string, Entity>()
  prototypes = new Map<string, Prototype>()
  systems = new Map<string, System>()
  dirtyEntities = new Map<string, Entity>()
  messenger = new Messenger()
  componentPools = new Map<string, ObjectPool<Component>>()
  entityPool: ObjectPool<Entity, [Manager]>
  tags = new Map<string, Map<string, Entity>>()
  groups = new Map<string, EntityGroup>()
  dynamicEntities = new Map<string, Entity>()

  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine
    this.entityPool = new ObjectPool<Entity, [Manager]>(Entity, this)
    for (const [name, Constructor] of Object.entries(Systems)) {
      if (gameEngine.options.headless === true) continue
      if (gameEngine.options.standaloneMode === true && name !== 'Render') continue
      lll(`Adding entity system: ${name}`)
      this.addSystem(new Constructor(gameEngine, this))
    }
  }
  get events(): EventEmitter { return this.gameEngine.events }
  get assetLoader(): AssetLoader { return this.gameEngine.assetLoader }
  getEntityById(id: string): Entity | undefined { return this.entities.get(id) }
  getDynamicEntities(): Map<string, Entity> { return this.dynamicEntities }
  getDynamicEntity(id: string): Entity | undefined { return this.dynamicEntities.get(id) }
  removeEntity(candidate: Entity | null | undefined): void {
    const entity = candidate && this.entities.get(candidate.id)
    if (!entity) throw new Error('Tried to remove entity not in list')
    this.removeAllComponentsFromEntity(entity)
    this.triggerEvent(Manager.ENTITY_REMOVE, entity)
    this.entities.delete(entity.id)
    this.dynamicEntities.delete(entity.id)
    entity.tags.length = 0
    for (const entities of this.tags.values()) entities.delete(entity.id)
    for (const system of [...entity.systems]) system.removeEntity(entity)
    this.entityPool.release(entity)
    this.removeEntityIfDirty(entity)
  }
  removeEntityById(id: string): Entity | null { const entity = this.getEntityById(id); if (!entity) return null; this.removeEntity(entity); return entity }
  removeEntityIfDirty(entity: Entity | null | undefined): void { if (entity) this.dirtyEntities.delete(entity.id) }
  addTagToEntity(entity: Entity, tag: string): void {
    let entities = this.tags.get(tag)
    if (!entities) { entities = new Map(); this.tags.set(tag, entities) }
    if (entities.has(entity.id)) return
    entities.set(entity.id, entity)
    entity.tags.push(tag)
  }
  removeTagFromEntity(entity: Entity, tag: string): void {
    if (!this.tags.get(tag)?.delete(entity.id)) return
    const index = entity.tags.indexOf(tag)
    if (index !== -1) entity.tags.splice(index, 1)
  }
  private resolveComponent(token: ComponentToken): ComponentConstructor {
    if (typeof token !== 'string') return token
    const Constructor = Object.values(Components).find(candidate => Entity.componentToName(candidate) === Entity.componentToName(token))
    if (!Constructor) throw new Error(`Unknown component: ${token}`)
    return Constructor
  }
  addComponentToEntity(entity: Entity, token: ComponentToken, data: Record<string, unknown>, prototype?: Prototype | null): Component {
    const Constructor = this.resolveComponent(token)
    entity.components.push(Constructor)
    const name = Entity.componentToName(Constructor)
    let pool = this.componentPools.get(name)
    if (!pool) { pool = new ObjectPool<Component>(Constructor); this.componentPools.set(name, pool) }
    const component = entity.onAddComponent(name, data, pool.aquire({ entity }), prototype)
    entity.setComponent(name, component)
    if (!(entity instanceof Prototype)) entity.setDirty()
    for (const group of this.groups.values()) {
      if (group.components.some(candidate => Entity.componentToName(candidate) === name) && entity.hasAllComponents(group.components) && !group.entities.includes(entity)) group.entities.push(entity)
    }
    this.triggerEvent(Manager.COMPONENT_ADDED, entity, Constructor)
    return component
  }
  removeAllComponentsFromEntity(entity: Entity): void { for (const component of [...entity.components].reverse()) this.removeComponentFromEntity(entity, component) }
  removeComponentFromEntity(entity: Entity, token: ComponentToken): void {
    const name = Entity.componentToName(token)
    const index = entity.components.findIndex(candidate => Entity.componentToName(candidate) === name)
    if (index === -1) return
    const Constructor = entity.components[index]
    this.triggerEvent(Manager.COMPONENT_REMOVE, entity, Constructor)
    for (const group of this.groups.values()) {
      if (!group.components.some(candidate => Entity.componentToName(candidate) === name)) continue
      const groupIndex = group.entities.indexOf(entity)
      if (groupIndex !== -1) group.entities.splice(groupIndex, 1)
    }
    entity.components.splice(index, 1)
    const component = Reflect.get(entity, name) as Component | undefined
    Reflect.deleteProperty(entity, name)
    if (component) this.componentPools.get(name)?.release(component)
    entity.setDirty()
  }
  queryComponents(components: ComponentToken[]): Entity[] { return (this.groups.get(Manager._groupKey(components)) || this._indexGroup(components)).entities }
  queryTag(tag: string): Entity[] { return [...(this.tags.get(tag)?.values() || [])] }
  poolStats(): Record<string, { used: number; size: number }> {
    const result: Record<string, { used: number; size: number }> = { entity: { used: this.entityPool.totalUsed(), size: this.entityPool.count } }
    for (const [name, pool] of this.componentPools) result[name] = { used: pool.totalUsed(), size: pool.count }
    return result
  }
  _indexGroup(components: ComponentToken[]): EntityGroup {
    const key = Manager._groupKey(components), existing = this.groups.get(key)
    if (existing) return existing
    const group = { components, entities: [...this.entities.values()].filter(entity => entity.hasAllComponents(components)) }
    this.groups.set(key, group)
    return group
  }
  triggerEvent(event: string, entity?: unknown, option?: unknown): void { this.messenger.trigger(event, entity, option) }
  addDirtyEntity(entity: Entity): void { this.dirtyEntities.set(entity.id, entity) }
  addSystem(system: System): void {
    this.systems.set(system.constructor.name, system)
    for (const entity of this.entities.values()) if (system.test(entity)) system.addEntity(entity)
  }
  getSystem(name: string): System | undefined { return this.systems.get(name) }
  removeSystem(name: string): void { const system = this.systems.get(name); this.systems.delete(name); system?.dispose() }
  cleanDirtyEntities(): void {
    for (const entity of this.dirtyEntities.values()) {
      for (const system of this.systems.values()) {
        const included = entity.systems.includes(system), eligible = system.test(entity)
        if (!included && eligible) system.addEntity(entity)
        else if (included && !eligible) system.removeEntity(entity)
      }
      entity.systemsDirty = false
    }
    this.dirtyEntities.clear()
  }
  start(): void {}
  update(time: number, elapsed: number): void {
    for (const system of this.systems.values()) {
      if (this.updateCounter % system.frequency > 0) continue
      this.cleanDirtyEntities()
      system.updateAll(elapsed)
    }
    this.updateCounter++
    this.lastUpdate = time
  }
  getNewId(_entity: Entity): string { return UID.DefaultUIDGenerator.next() }
  async loadPrototype(key: string, fileName: string): Promise<void> {
    const data = await this.assetLoader.loadJsonFile(fileName), prototype = new Prototype(this)
    prototype.loadComponents(data)
    this.prototypes.set(key, prototype)
  }
  async loadPrototypes(reload = false): Promise<void> {
    if (this.prototypes.size && !reload) return
    const dataPath = AGate.getDataPath('Prototypes'), directories = await this.assetLoader.findDirs(dataPath)
    const pending: Promise<void>[] = []
    if (Array.isArray(directories)) {
      for (const directory of directories) {
        const files = await this.assetLoader.findFiles(directory, 'json')
        if (Array.isArray(files)) for (const file of files) pending.push(this.loadPrototype(Utils.getFileBase(file), file))
      }
    } else {
      for (const [type, entries] of directories) {
        if (!(entries instanceof Map)) continue
        for (const fileName of entries.keys()) pending.push(this.loadPrototype(Utils.getFileBase(fileName), `${dataPath}/${type}/${fileName}`))
      }
    }
    await Promise.all(pending)
  }
  async newEntity(id: string, raw: unknown): Promise<Entity> {
    const data = entityDocument(raw), entity = this.entityPool.aquire({})
    if (this.entities.has(id)) {
      console.warn(`Duplicate converted entity ID ${id}; retaining both records`)
      entity.sourceId = id
      do { id = `!${id}` } while (this.entities.has(id))
    }
    entity.id = id
    const prototypeId = data.Base?.prototype
    if (prototypeId) {
      const prototype = this.prototypes.get(String(prototypeId))
      if (!prototype) throw new Error(`Missing converted prototype: ${prototypeId}`)
      prototype.extendEntity(entity, data)
    }
    this.entities.set(entity.id, entity)
    if (EntityUtils.isDynamic(entity)) this.dynamicEntities.set(entity.id, entity)
    this.triggerEvent(Manager.ENTITY_CREATED, entity)
    return entity
  }
  static _groupKey(components: ComponentToken[]): string { return components.map(Entity.componentToName).sort().join('-') }
}
