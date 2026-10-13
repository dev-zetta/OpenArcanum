import type { ScriptMessageState } from '../../../../@openarcanum/agate/src/client/ClientScriptTypes'
import Component, { setComponentTemplate } from '@ember/component'
import { service } from '@ember/service'
import { action, computed } from '@ember/object'
import { scheduleOnce } from '@ember/runloop'
import { getAGate, getDataStatus, loadGuiStylesheet } from 'open-arcanum/lib/runtime'
import template from './layout.hbs'
import type Owner from '@ember/owner'
import type { DataStatus, GameClient, GameEngine, ClientEvents, DoorTarget, ContainerTarget, ItemRow,
  DisplayTarget, InteractionState, CheckpointState, PauseState, InventoryState, GroundState,
  ConversationState, JournalState, CharacterState } from '../../../types/runtime'

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)
// The authored GUI Store is a legacy Ember Data boundary. The renderer only
// displays the queried records; it does not mutate or infer their attributes.
interface GuiStore { query(type: 'gui-widget', query: { filter: { type: 'window' } }): PromiseLike<Iterable<unknown>> }


class GameRender extends Component {
  @service declare store: GuiStore

  classNames = ['game-render']
  classNameBindings = ['dataStatus.ownedModule:owned-workshop']
  attributeBindings = ['runtimeState:data-runtime-state']

  @computed('running', 'starting', 'error')
  get runtimeState() {
    return this.starting ? 'starting' : this.error ? 'error' : this.running ? 'running' : 'ready'
  }
  widgets: Iterable<unknown> | null = null
  running = false
  starting = false
  error: string | null = null
  doors: DoorTarget[] = []
  selectedDoorId = ''
  interaction: InteractionState | null = null
  scriptMessage: ScriptMessageState | null = null
  containers: ContainerTarget[] = []
  selectedContainerId = ''
  containerInteraction: InteractionState | null = null
  checkpoint: CheckpointState | null = null
  checkpointSupported = false
  pause: PauseState | null = null
  pauseSupported = false
  inventory: InventoryState | null = null
  transferPending: { kind: 'take' | 'take-all' | 'put'; targetId: string; itemId?: string } | null = null
  groundItems: ItemRow[] = []
  groundSupported = false
  selectedGroundId = ''
  ground: GroundState | null = null
  groundPending: { action: 'pickup' | 'drop'; itemId: string } | null = null
  conversationTargets: DisplayTarget[] = []
  conversationSupported = false
  selectedConversationId = ''
  conversation: ConversationState | null = null
  conversationPending: { action: 'begin' | 'reply'; value: string } | null = null
  journal: JournalState | null = null
  journalPending: object | null = null
  character: CharacterState | null = null
  characterPending: object | null = null

  @computed('doors.length', 'containers.length', 'conversationSupported', 'journal')
  get interactionStackAvailable() { return this.doors.length > 0 || this.containers.length > 0 || this.conversationSupported || !!this.journal }

  @computed('conversationTargets', 'selectedConversationId')
  get conversationChoices() {
    return this.conversationTargets.map((target, index) => ({ id: target.id,
      choiceLabel: `${target.label || 'Character'} ${index + 1}`, selected: target.id === this.selectedConversationId }))
  }

  @computed('conversation.status')
  get conversationReady() { return this.conversation?.status === 'ready' }

  @computed('conversation.status', 'conversationPending')
  get conversationBusy() { return this.conversation?.status === 'pending' || !!this.conversationPending }

  @computed('journal.status', 'journalPending')
  get journalBusy() { return this.journal?.status === 'pending' || !!this.journalPending }

  @computed('character.status', 'characterPending')
  get characterBusy() { return this.character?.status === 'pending' || !!this.characterPending }

  @computed('character.status', 'character.supported')
  get characterValuesAvailable() { return this.character?.status === 'ready' && this.character?.supported === true }

  @computed('characterValuesAvailable', 'character.attributes')
  get characterAttributes() { return this.character?.status === 'ready' && this.character.supported ? this.character.attributes || [] : [] }

  @computed('checkpointBusy', 'interactionBusy', 'pauseBusy', 'pause.moving', 'inventoryBusy', 'groundBusy', 'conversationBusy', 'journalBusy', 'characterBusy')
  get journalControlsBusy() { return this.checkpointBusy || this.interactionBusy || this.pauseBusy || this.pause?.moving === true || this.inventoryBusy || this.groundBusy || this.conversationBusy || this.journalBusy || this.characterBusy }

  @computed('doors', 'selectedDoorId')
  get doorChoices() {
    return this.doors.map((door, index) => ({ ...door,
      choiceLabel: `${door.label || 'Door'} ${index + 1} — ${door.open ? 'open' : 'closed'}${door.locked ? ' (locked)' : ''}`,
      selected: door.id === this.selectedDoorId }))
  }

  @computed('doors', 'selectedDoorId')
  get selectedDoor() { return this.doors.find(door => door.id === this.selectedDoorId) }

  @computed('containers', 'selectedContainerId')
  get containerChoices() {
    return this.containers.map((container, index) => ({ ...container,
      choiceLabel: `${container.label || 'Container'} ${index + 1}${container.locked ? ' (locked)' : ''}`,
      selected: container.id === this.selectedContainerId }))
  }

  @computed('containers', 'selectedContainerId')
  get selectedContainer() { return this.containers.find(container => container.id === this.selectedContainerId) }

  @computed('groundItems', 'selectedGroundId')
  get groundChoices() {
    return this.groundItems.map((item, index) => ({ ...item,
      choiceLabel: `${item.label} ${index + 1}`, selected: item.id === this.selectedGroundId }))
  }

  @computed('inventory', 'groundSupported', 'character')
  get inventoryPanelAvailable() { return !!this.inventory || this.groundSupported || !!this.character }

  @computed('containerInteraction.items', 'containerInteraction.canTake')
  get containerItems() {
    return (this.containerInteraction?.items || []).map(item => ({ ...item,
      displayLabel: `${item.label}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`,
      takeAvailable: this.containerInteraction?.canTake === true && ['Generic', 'Key'].includes(item.type) }))
  }

  @computed('inventory.status', 'inventory.known', 'containerInteraction.status', 'containerInteraction.inspected',
    'containerInteraction.canTake', 'containerInteraction.targetId', 'containerInteraction.items.length', 'selectedContainerId')
  get canTakeAllFromSelectedContainer() {
    return this.inventory?.known === true && this.inventory?.status === 'ready' &&
      this.containerInteraction?.status === 'completed' && this.containerInteraction?.inspected === true &&
      this.containerInteraction?.canTake === true && this.containerInteraction.targetId === this.selectedContainerId &&
      (this.containerInteraction.items?.length || 0) > 0
  }

  @computed('inventory.status', 'inventory.known', 'containerInteraction.status', 'containerInteraction.inspected',
    'containerInteraction.canPut', 'containerInteraction.targetId', 'selectedContainerId')
  get canPutInSelectedContainer() {
    return this.inventory?.known === true && this.inventory?.status === 'ready' &&
      this.containerInteraction?.status === 'completed' && this.containerInteraction?.inspected === true &&
      this.containerInteraction?.canPut === true && this.containerInteraction.targetId === this.selectedContainerId
  }

  @computed('inventory.status', 'inventory.known', 'inventory.carrying')
  get carrying() {
    return this.inventory?.known && this.inventory.status === 'ready' && this.inventory.carrying?.supported ? this.inventory.carrying : null
  }

  @computed('inventory.items', 'inventory.known', 'canPutInSelectedContainer', 'carrying')
  get inventoryItems() {
    return this.inventory?.known === true ? (this.inventory.items || []).map(item => ({ ...item,
      putAvailable: this.canPutInSelectedContainer && ['Generic', 'Key'].includes(item.type),
      dropAvailable: item.canDrop === true && item.type === 'Generic',
      weightAvailable: !!this.carrying && item.weight !== undefined })) : []
  }

  @computed('inventory.status', 'transferPending', 'groundPending')
  get inventoryBusy() { return this.inventory?.status === 'pending' || !!this.transferPending || !!this.groundPending }

  @computed('ground.status', 'groundPending')
  get groundBusy() { return this.ground?.status === 'pending' || !!this.groundPending }

  @computed('interactionBusy', 'transferPending')
  get containerBusy() { return this.interactionBusy || !!this.transferPending }

  @computed('controlsBusy', 'inventory.known', 'inventory.status')
  get transferControlsBusy() { return this.controlsBusy || this.inventory?.known !== true || this.inventory?.status !== 'ready' }

  @computed('interaction.status', 'containerInteraction.status')
  get interactionBusy() { return ['pending', 'approaching'].includes(this.interaction?.status || '') ||
    ['pending', 'approaching'].includes(this.containerInteraction?.status || '') }

  @computed('checkpoint.status')
  get checkpointBusy() { return this.checkpoint?.status === 'pending' }

  @computed('pause.status')
  get pauseBusy() { return this.pause?.status === 'pending' }

  @computed('checkpointBusy', 'interactionBusy', 'pauseBusy', 'pause.paused', 'inventoryBusy', 'groundBusy', 'conversationBusy', 'journalBusy', 'characterBusy')
  get controlsBusy() { return this.checkpointBusy || this.interactionBusy || this.pauseBusy || this.pause?.paused === true || this.inventoryBusy || this.groundBusy || this.conversationBusy || this.journalBusy || this.characterBusy }

  @computed('checkpointBusy', 'interactionBusy', 'pauseBusy', 'pause.moving', 'inventoryBusy', 'groundBusy', 'conversationBusy', 'journalBusy', 'characterBusy')
  get checkpointControlsBusy() { return this.checkpointBusy || this.interactionBusy || this.pauseBusy || this.pause?.moving === true || this.inventoryBusy || this.groundBusy || this.conversationBusy || this.journalBusy || this.characterBusy }

  @computed('checkpointBusy', 'pauseBusy', 'inventoryBusy', 'groundBusy', 'conversationBusy', 'journalBusy', 'characterBusy')
  get pauseControlsBusy() { return this.checkpointBusy || this.pauseBusy || this.inventoryBusy || this.groundBusy || this.conversationBusy || this.journalBusy || this.characterBusy }

  dataStatus: DataStatus
  declare client: GameClient
  declare gameEngine: GameEngine
  declare startupAbort: AbortController
  declare stopLocalServer: (() => Promise<unknown> | undefined) | undefined
  declare onWindowResize: (() => void) | undefined
  declare onRuntimeError: ((error: Error) => void) | undefined
  declare onInteractionsUpdated: (doors: ClientEvents['World:InteractionsUpdated']) => void
  declare onScriptMessage: (message: ClientEvents['Player:ScriptMessage']) => void
  declare onInteractionUpdated: (interaction: ClientEvents['Player:InteractionUpdated']) => void
  declare onContainersUpdated: (containers: ClientEvents['World:ContainersUpdated']) => void
  declare onCheckpointUpdated: (checkpoint: ClientEvents['Player:CheckpointUpdated']) => void
  declare onPauseUpdated: (pause: ClientEvents['Player:PauseUpdated']) => void
  declare onInventoryUpdated: (inventory: ClientEvents['Player:InventoryUpdated']) => void
  declare onGroundItemsUpdated: (items: ClientEvents['World:GroundItemsUpdated'] | undefined) => void
  declare onGroundUpdated: (ground: ClientEvents['Player:GroundUpdated']) => void
  declare onConversationTargetsUpdated: (targets: ClientEvents['World:ConversationTargetsUpdated'] | undefined) => void
  declare onConversationUpdated: (conversation: ClientEvents['Player:ConversationUpdated']) => void
  declare onJournalUpdated: (journal: ClientEvents['Player:JournalUpdated']) => void
  declare onCharacterUpdated: (character: ClientEvents['Player:CharacterUpdated']) => void

  constructor(owner?: Owner) {
    super(owner)
    this.dataStatus = getDataStatus()
  }

  getElement() { return this.element }
  getManager() { return this.client.guiManager }

  @action
  refreshDataStatus() {
    this.set('dataStatus', getDataStatus())
  }

  @action
  async startGame() {
    if (this.starting || this.running || !this.dataStatus.ready) return
    this.setProperties({ starting: true, error: null })
    this.startupAbort = new AbortController()
    const desktop = window.openArcanumDesktop
    const requestId = crypto.randomUUID()
    this.stopLocalServer = () => desktop?.stopLocalServer?.(requestId)
    try {
      const runtime = getAGate()
      if (!runtime) throw new Error('The desktop game runtime is unavailable')
      const ownedModule = this.dataStatus.ownedModule === true
      const widgets = ownedModule ? [] : await this.store.query('gui-widget', { filter: { type: 'window' } })
      const canvas = this.element?.querySelector('canvas')
      if (!canvas) throw new Error('The game canvas is unavailable')
      if (!ownedModule) await loadGuiStylesheet(runtime.getAppUrl('gui/gui-images.css'))
      if (this.isDestroying || this.isDestroyed) return
      if (!desktop?.startLocalServer) throw new Error('The desktop local server bridge is unavailable')
      const authoritySession = await desktop.startLocalServer(requestId)
      if (this.isDestroying || this.isDestroyed) {
        await this.stopLocalServer?.()
        return
      }
      this.gameEngine = runtime.createEngine()
      this.client = await this.gameEngine.createClient(canvas, {
        standaloneMode: true,
        ...(ownedModule ? { moduleId: 'inventory-workshop', authoredGui: false } : {}),
        mapId: this.dataStatus.mapId,
        authoritySession,
        scriptManifestPath: desktop.config.scriptManifestPath,
        signal: this.startupAbort.signal
      })
      if (this.isDestroying || this.isDestroyed) {
        this.client.stop()
        await this.stopLocalServer?.()
        return
      }
      this.onRuntimeError = error => {
        this.removeInteractionListeners()
        if (!this.isDestroying && !this.isDestroyed) this.setProperties({ error: errorMessage(error), running: false })
        desktop?.stopLocalServer(requestId).catch(error => console.error('Local server shutdown failed', error))
      }
      this.client.events.on('Game:Error', this.onRuntimeError)
      this.onInteractionsUpdated = doors => {
        if (this.isDestroying || this.isDestroyed) return
        this.set('doors', doors || [])
        if (!this.doors.some(door => door.id === this.selectedDoorId)) this.set('selectedDoorId', this.doors[0]?.id || '')
      }
      this.onInteractionUpdated = interaction => {
        if (this.isDestroying || this.isDestroyed) return
        if (!interaction) { this.set('containerInteraction', null); return }
        if (interaction.kind === 'container') {
          this.setProperties({ containerInteraction: interaction, selectedContainerId: interaction.targetId })
        } else if (interaction.kind === 'ground' || interaction.kind === 'conversation') {
          this.set('containerInteraction', null)
        } else this.setProperties({ interaction, selectedDoorId: interaction.targetId, containerInteraction: null })
      }
      this.onContainersUpdated = containers => {
        if (this.isDestroying || this.isDestroyed) return
        this.set('containers', containers || [])
        if (!this.containers.some(container => container.id === this.selectedContainerId)) {
          this.setProperties({ selectedContainerId: this.containers[0]?.id || '', containerInteraction: null })
        }
      }
      this.client.events.on('World:InteractionsUpdated', this.onInteractionsUpdated)
      this.client.events.on('Player:InteractionUpdated', this.onInteractionUpdated)
      this.onScriptMessage = message => {
        if (!this.isDestroying && !this.isDestroyed) this.set('scriptMessage', message)
      }
      this.client.events.on('Player:ScriptMessage', this.onScriptMessage)
      if (this.client.scriptMessage) this.onScriptMessage(this.client.scriptMessage)
      this.client.events.on('World:ContainersUpdated', this.onContainersUpdated)
      this.onCheckpointUpdated = checkpoint => {
        if (this.isDestroying || this.isDestroyed || !checkpoint) return
        this.set('checkpoint', checkpoint)
      }
      this.client.events.on('Player:CheckpointUpdated', this.onCheckpointUpdated)
      this.onPauseUpdated = pause => {
        if (this.isDestroying || this.isDestroyed || !pause) return
        this.setProperties({ pause, pauseSupported: pause.supported === true })
      }
      this.client.events.on('Player:PauseUpdated', this.onPauseUpdated)
      this.onInventoryUpdated = inventory => {
        if (this.isDestroying || this.isDestroyed) return
        this.set('inventory', inventory || null)
      }
      this.client.events.on('Player:InventoryUpdated', this.onInventoryUpdated)
      if (this.client.inventoryState) this.onInventoryUpdated(this.client.inventoryState)
      this.onGroundItemsUpdated = items => {
        if (this.isDestroying || this.isDestroyed || !Array.isArray(items)) return
        this.setProperties({ groundItems: items, groundSupported: true })
        if (!items.some(item => item.id === this.selectedGroundId)) this.set('selectedGroundId', items[0]?.id || '')
      }
      this.onGroundUpdated = ground => {
        if (this.isDestroying || this.isDestroyed) return
        this.set('ground', ground || null)
        if (ground?.targetId && this.groundItems.some(item => item.id === ground.targetId)) this.set('selectedGroundId', ground.targetId)
      }
      this.client.events.on('World:GroundItemsUpdated', this.onGroundItemsUpdated)
      this.client.events.on('Player:GroundUpdated', this.onGroundUpdated)
      this.onGroundItemsUpdated(this.client.authorityState?.groundItems)
      if (this.client.groundState) this.onGroundUpdated(this.client.groundState)
      this.onConversationTargetsUpdated = targets => {
        if (this.isDestroying || this.isDestroyed || !Array.isArray(targets)) return
        this.setProperties({ conversationTargets: targets, conversationSupported: true })
        if (!targets.some(target => target.id === this.selectedConversationId)) this.set('selectedConversationId', targets[0]?.id || '')
      }
      this.onConversationUpdated = conversation => {
        if (this.isDestroying || this.isDestroyed) return
        this.set('conversation', conversation || null)
        if (conversation?.targetId && this.conversationTargets.some(target => target.id === conversation.targetId)) {
          this.set('selectedConversationId', conversation.targetId)
        }
        if (conversation?.status === 'ready') scheduleOnce('afterRender', this, this.focusConversation)
      }
      this.onJournalUpdated = journal => {
        if (this.isDestroying || this.isDestroyed) return
        this.set('journal', journal || null)
      }
      this.client.events.on('World:ConversationTargetsUpdated', this.onConversationTargetsUpdated)
      this.client.events.on('Player:ConversationUpdated', this.onConversationUpdated)
      this.client.events.on('Player:JournalUpdated', this.onJournalUpdated)
      this.onConversationTargetsUpdated(this.client.authorityState?.conversationTargets)
      if (this.client.conversationState) this.onConversationUpdated(this.client.conversationState)
      if (this.client.journalState) this.onJournalUpdated(this.client.journalState)
      this.onCharacterUpdated = character => {
        if (this.isDestroying || this.isDestroyed) return
        this.set('character', character || null)
      }
      this.client.events.on('Player:CharacterUpdated', this.onCharacterUpdated)
      if (this.client.characterState) this.onCharacterUpdated(this.client.characterState)
      this.onPauseUpdated(this.client.pauseState || { ...this.client.authorityState?.pause,
        moving: !!this.client.authorityState?.actors?.find(actor => actor.id === this.client.player?.id)?.movement,
        status: 'idle', message: this.client.authorityState?.pause?.paused ? 'Local game paused.' : 'Local game running.' })
      this.set('checkpointSupported', this.client.authorityState?.checkpoint?.supported === true)
      if (this.client.checkpointState) this.onCheckpointUpdated(this.client.checkpointState)
      this.onInteractionsUpdated(this.client.authorityState?.doors || [])
      this.onContainersUpdated(this.client.authorityState?.containers || [])
      if (this.client.interactionState) this.onInteractionUpdated(this.client.interactionState)
      const manager = this.getManager()
      manager.setRootWidget(this)
      if (!ownedModule) manager.setMouseSprite('cursor')
      this.setProperties({ widgets, running: true })
      this.onWindowResize = () => this.client.emitUI('window.resize')
      window.addEventListener('resize', this.onWindowResize)
    } catch (error) {
      this.gameEngine?.client?.stop()
      await this.stopLocalServer?.()?.catch(error => console.error('Local server shutdown failed', error))
      if (this.isDestroying || this.isDestroyed) return
      console.error('Game startup failed', error)
      if (!this.isDestroying && !this.isDestroyed) this.set('error', errorMessage(error))
    } finally {
      if (!this.isDestroying && !this.isDestroyed) this.set('starting', false)
    }
  }

  @action
  selectDoor(event: Event) {
    this.setProperties({ selectedDoorId: (event.target as HTMLSelectElement).value, interaction: null })
  }

  @action
  async useSelectedDoor() {
    if (!this.selectedDoorId || this.controlsBusy || !this.running) return
    const targetId = this.selectedDoorId
    try { await this.client.useTarget(targetId) }
    catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('interaction', { targetId, status: 'rejected', message: errorMessage(error) })
      }
    }
  }

  @action
  selectContainer(event: Event) {
    this.setProperties({ selectedContainerId: (event.target as HTMLSelectElement).value, containerInteraction: null })
  }

  @action
  async inspectSelectedContainer() {
    if (!this.selectedContainerId || this.controlsBusy || !this.running) return
    const targetId = this.selectedContainerId
    this.set('containerInteraction', { targetId, kind: 'container', status: 'pending', message: 'Inspecting container…' })
    try { await this.client.useTarget(targetId) }
    catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('containerInteraction', { targetId, kind: 'container', status: 'rejected', message: errorMessage(error) })
      }
    }
  }

  @action
  takeContainerItem(itemId: string) { return this.runItemTransfer('take', itemId) }

  @action
  takeAllContainerItems() { return this.runItemTransfer('take-all') }

  @action
  putInventoryItem(itemId: string) { return this.runItemTransfer('put', itemId) }

  async runItemTransfer(kind: 'take' | 'take-all' | 'put', itemId?: string) {
    const interaction = this.containerInteraction
    const taking = kind !== 'put', batch = kind === 'take-all'
    const sourceItems = taking ? interaction?.items : this.inventory?.items
    const supported = batch ? this.canTakeAllFromSelectedContainer :
      taking ? interaction?.canTake === true : this.canPutInSelectedContainer
    if (!this.running || this.transferControlsBusy || !supported || interaction?.inspected !== true ||
        interaction?.status !== 'completed' || interaction?.targetId !== this.selectedContainerId ||
      !(batch ? (sourceItems?.length || 0) > 0 : sourceItems?.some(item => item.id === itemId && ['Generic', 'Key'].includes(item.type)))) return
    const request = { kind, targetId: interaction.targetId, itemId }
    this.set('transferPending', request)
    try {
      if (batch) await this.client.takeAllItems(request.targetId)
      else if (itemId) await this.client[taking ? 'takeItem' : 'putItem'](request.targetId, itemId)
      // Both owner lists come from the client's private, validated response.
      // The button never removes a row or creates an inventory entry itself.
    } catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('containerInteraction', { targetId: request.targetId, kind: 'container',
          status: 'rejected', message: errorMessage(error) })
      }
    } finally {
      if (!this.isDestroying && !this.isDestroyed && this.transferPending === request) this.set('transferPending', null)
    }
  }

  @action
  selectGroundItem(event: Event) { this.set('selectedGroundId', (event.target as HTMLSelectElement).value) }

  @action
  pickupGroundItem() { return this.runGroundCommand('pickup', this.selectedGroundId) }

  @action
  dropInventoryItem(itemId: string) { return this.runGroundCommand('drop', itemId) }

  async runGroundCommand(action: 'pickup' | 'drop', itemId: string) {
    if (!this.running || this.transferControlsBusy ||
        (action === 'pickup' ? !this.groundItems.some(item => item.id === itemId) :
          !this.inventory?.items?.some(item => item.id === itemId && item.type === 'Generic' && item.canDrop === true))) return
    const request = { action, itemId }
    this.setProperties({ groundPending: request, ground: { action, status: 'pending',
      message: action === 'pickup' ? 'Picking up item…' : 'Dropping item…' } })
    try {
      await this.client[action === 'pickup' ? 'pickupGroundItem' : 'dropItem'](itemId)
      // Public floor state and private inventory rows arrive through client
      // events. The view never moves an item before those validated updates.
    } catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('ground', { action, status: 'rejected', message: errorMessage(error) })
      }
    } finally {
      if (!this.isDestroying && !this.isDestroyed && this.groundPending === request) this.set('groundPending', null)
    }
  }

  focusConversation() {
    if (this.isDestroying || this.isDestroyed || !this.running || !this.conversationReady) return
    const content = this.element?.querySelector<HTMLElement>('[data-conversation-content]')
    content?.scrollIntoView({ block: 'nearest' })
    content?.focus({ preventScroll: true })
  }

  @action
  selectConversation(event: Event) { this.set('selectedConversationId', (event.target as HTMLSelectElement).value) }

  @action
  beginConversation() { return this.runConversationCommand('begin', this.selectedConversationId) }

  @action
  replyConversation(optionId: string) { return this.runConversationCommand('reply', optionId) }

  async runConversationCommand(action: 'begin' | 'reply', value: string) {
    if (!this.running || this.controlsBusy || (action === 'begin'
      ? !this.conversationTargets.some(target => target.id === value)
      : !this.conversationReady || !this.conversation?.options?.some(option => option.id === value))) return
    const request = { action, value }
    this.setProperties({ conversationPending: request, conversation: { ...this.conversation, options: this.conversation?.options || [], status: 'pending',
      message: action === 'begin' ? 'Approaching character…' : 'Sending reply…' } })
    try {
      await this.client[action === 'begin' ? 'beginConversation' : 'replyConversation'](value)
      // Dialogue choices and quest progress arrive only through private client
      // events. The component never infers them from inventory or button intent.
    } catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('conversation', { ...this.conversation, status: 'rejected', message: errorMessage(error), options: [] })
      }
    } finally {
      if (!this.isDestroying && !this.isDestroyed && this.conversationPending === request) this.set('conversationPending', null)
    }
  }

  @action
  closeConversation() {
    if (!this.running || this.conversationBusy) return
    this.client.closeConversation()
  }

  @action
  async refreshJournal() {
    if (!this.running || this.journalControlsBusy) return
    const request = {}
    this.setProperties({ journalPending: request, journal: { ...this.journal, entries: this.journal?.entries || [], status: 'pending', message: 'Refreshing journal…' } })
    try { await this.client.refreshJournal() }
    catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('journal', { ...this.journal, entries: this.journal?.entries || [], status: 'rejected', message: errorMessage(error) })
      }
    } finally {
      if (!this.isDestroying && !this.isDestroyed && this.journalPending === request) this.set('journalPending', null)
    }
  }

  @action
  async refreshCharacter() {
    if (!this.running || this.journalControlsBusy) return
    const request = {}
    this.setProperties({ characterPending: request, character: { supported: false, status: 'pending', message: 'Refreshing character…' } })
    try { await this.client.refreshCharacter() }
    catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('character', { supported: false, status: 'rejected', message: errorMessage(error) })
      }
    } finally {
      if (!this.isDestroying && !this.isDestroyed && this.characterPending === request) this.set('characterPending', null)
    }
  }

  @action
  async increaseAttribute(statId: string) {
    if (!this.running || this.controlsBusy || !this.characterValuesAvailable ||
        !this.characterAttributes.some(attribute => attribute.id === statId && attribute.canIncrease === true)) return
    const request = { statId }
    this.setProperties({ characterPending: request, character: { supported: false, status: 'pending', message: 'Increasing attribute…' } })
    try { await this.client.spendCharacterPoint(statId) }
    catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running && this.character?.status !== 'ready') {
        this.set('character', { supported: false, status: 'rejected', message: errorMessage(error) })
      }
    } finally {
      if (!this.isDestroying && !this.isDestroyed && this.characterPending === request) this.set('characterPending', null)
    }
  }

  @action
  saveCheckpoint() { return this.runCheckpoint('save') }

  @action
  loadCheckpoint() { return this.runCheckpoint('load') }

  @action
  async togglePause() {
    if (!this.running || !this.pauseSupported || this.pauseControlsBusy) return
    const paused = !this.pause?.paused
    this.set('pause', { ...this.pause, status: 'pending', message: paused ? 'Pausing local game…' : 'Resuming local game…' })
    try {
      await this.client.setPaused(paused)
      // The client publishes completed state only after its ACK and matching
      // snapshot. The component never derives server state from button intent.
    } catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('pause', { ...this.pause, status: 'rejected', message: errorMessage(error) })
      }
    }
  }

  async runCheckpoint(action: 'save' | 'load') {
    if (!this.running || !this.checkpointSupported || this.checkpointControlsBusy) return
    this.set('checkpoint', { action, status: 'pending',
      message: action === 'save' ? 'Saving checkpoint…' : 'Loading checkpoint…' })
    try {
      const result = await this.client[action === 'save' ? 'saveCheckpoint' : 'loadCheckpoint']()
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('checkpoint', { action, status: 'completed', savedAt: result.savedAt,
          message: action === 'save' ? 'Checkpoint saved.' : 'Checkpoint loaded.' })
      }
    } catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('checkpoint', { action, status: 'rejected', message: errorMessage(error) })
      }
    }
  }

  removeInteractionListeners() {
    if (!this.client) return
    if (this.onInteractionsUpdated) this.client.events.off('World:InteractionsUpdated', this.onInteractionsUpdated)
    if (this.onInteractionUpdated) this.client.events.off('Player:InteractionUpdated', this.onInteractionUpdated)
    if (this.onScriptMessage) this.client.events.off('Player:ScriptMessage', this.onScriptMessage)
    if (this.onContainersUpdated) this.client.events.off('World:ContainersUpdated', this.onContainersUpdated)
    if (this.onCheckpointUpdated) this.client.events.off('Player:CheckpointUpdated', this.onCheckpointUpdated)
    if (this.onPauseUpdated) this.client.events.off('Player:PauseUpdated', this.onPauseUpdated)
    if (this.onInventoryUpdated) this.client.events.off('Player:InventoryUpdated', this.onInventoryUpdated)
    if (this.onGroundItemsUpdated) this.client.events.off('World:GroundItemsUpdated', this.onGroundItemsUpdated)
    if (this.onGroundUpdated) this.client.events.off('Player:GroundUpdated', this.onGroundUpdated)
    if (this.onConversationTargetsUpdated) this.client.events.off('World:ConversationTargetsUpdated', this.onConversationTargetsUpdated)
    if (this.onConversationUpdated) this.client.events.off('Player:ConversationUpdated', this.onConversationUpdated)
    if (this.onJournalUpdated) this.client.events.off('Player:JournalUpdated', this.onJournalUpdated)
    if (this.onCharacterUpdated) this.client.events.off('Player:CharacterUpdated', this.onCharacterUpdated)
  }

  willDestroyElement() {
    this.startupAbort?.abort()
    if (this.onWindowResize) window.removeEventListener('resize', this.onWindowResize)
    const client = this.client || this.gameEngine?.client
    this.removeInteractionListeners()
    if (client) {
      if (this.onRuntimeError) client.events.off('Game:Error', this.onRuntimeError)
      client.stop()
    }
    this.stopLocalServer?.()?.catch(error => console.error('Local server shutdown failed', error))
    return super.willDestroyElement()
  }
}

setComponentTemplate(template, GameRender)
export default GameRender
