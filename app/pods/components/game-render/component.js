import Component, { setComponentTemplate } from '@ember/component'
import { service } from '@ember/service'
import { action, computed } from '@ember/object'
import { scheduleOnce } from '@ember/runloop'
import { getAGate, getDataStatus, loadGuiStylesheet } from 'open-arcanum/lib/runtime'
import template from './layout.hbs'

class GameRender extends Component {
  @service store

  classNames = ['game-render']
  classNameBindings = ['dataStatus.ownedModule:owned-workshop']
  attributeBindings = ['runtimeState:data-runtime-state']

  @computed('running', 'starting', 'error')
  get runtimeState() {
    return this.starting ? 'starting' : this.error ? 'error' : this.running ? 'running' : 'ready'
  }
  widgets = null
  running = false
  starting = false
  error = null
  doors = []
  selectedDoorId = ''
  interaction = null
  containers = []
  selectedContainerId = ''
  containerInteraction = null
  checkpoint = null
  checkpointSupported = false
  pause = null
  pauseSupported = false
  inventory = null
  transferPending = null
  groundItems = []
  groundSupported = false
  selectedGroundId = ''
  ground = null
  groundPending = null
  conversationTargets = []
  conversationSupported = false
  selectedConversationId = ''
  conversation = null
  conversationPending = null
  journal = null
  journalPending = null
  character = null
  characterPending = null

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
      this.containerInteraction.items?.length > 0
  }

  @computed('inventory.status', 'inventory.known', 'containerInteraction.status', 'containerInteraction.inspected',
    'containerInteraction.canPut', 'containerInteraction.targetId', 'selectedContainerId')
  get canPutInSelectedContainer() {
    return this.inventory?.known === true && this.inventory?.status === 'ready' &&
      this.containerInteraction?.status === 'completed' && this.containerInteraction?.inspected === true &&
      this.containerInteraction?.canPut === true && this.containerInteraction.targetId === this.selectedContainerId
  }

  @computed('inventory.items', 'inventory.known', 'canPutInSelectedContainer')
  get inventoryItems() {
    return this.inventory?.known === true ? (this.inventory.items || []).map(item => ({ ...item,
      putAvailable: this.canPutInSelectedContainer && ['Generic', 'Key'].includes(item.type),
      dropAvailable: item.canDrop === true && item.type === 'Generic' })) : []
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
  get interactionBusy() { return ['pending', 'approaching'].includes(this.interaction?.status) ||
    ['pending', 'approaching'].includes(this.containerInteraction?.status) }

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

  constructor() {
    super(...arguments)
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
      const ownedModule = this.dataStatus.ownedModule === true
      const widgets = ownedModule ? [] : await this.store.query('gui-widget', { filter: { type: 'window' } })
      const canvas = this.element.querySelector('canvas')
      if (!ownedModule) await loadGuiStylesheet(runtime.getAppUrl('gui/gui-images.css'))
      if (this.isDestroying || this.isDestroyed) return
      if (!desktop?.startLocalServer) throw new Error('The desktop local server bridge is unavailable')
      const authoritySession = await desktop.startLocalServer(requestId)
      if (this.isDestroying || this.isDestroyed) {
        await this.stopLocalServer()
        return
      }
      this.gameEngine = runtime.createEngine()
      this.client = await this.gameEngine.createClient(canvas, {
        standaloneMode: true,
        ...(ownedModule ? { moduleId: 'inventory-workshop', authoredGui: false } : {}),
        mapId: this.dataStatus.mapId,
        authoritySession,
        signal: this.startupAbort.signal
      })
      if (this.isDestroying || this.isDestroyed) {
        this.client.stop()
        await this.stopLocalServer()
        return
      }
      this.onRuntimeError = error => {
        this.removeInteractionListeners()
        if (!this.isDestroying && !this.isDestroyed) this.setProperties({ error: error.message, running: false })
        desktop.stopLocalServer(requestId).catch(error => console.error('Local server shutdown failed', error))
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
      await this.stopLocalServer()?.catch(error => console.error('Local server shutdown failed', error))
      if (this.isDestroying || this.isDestroyed) return
      console.error('Game startup failed', error)
      if (!this.isDestroying && !this.isDestroyed) this.set('error', error.message)
    } finally {
      if (!this.isDestroying && !this.isDestroyed) this.set('starting', false)
    }
  }

  @action
  selectDoor(event) {
    this.setProperties({ selectedDoorId: event.target.value, interaction: null })
  }

  @action
  async useSelectedDoor() {
    if (!this.selectedDoorId || this.controlsBusy || !this.running) return
    const targetId = this.selectedDoorId
    try { await this.client.useTarget(targetId) }
    catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('interaction', { targetId, status: 'rejected', message: error.message })
      }
    }
  }

  @action
  selectContainer(event) {
    this.setProperties({ selectedContainerId: event.target.value, containerInteraction: null })
  }

  @action
  async inspectSelectedContainer() {
    if (!this.selectedContainerId || this.controlsBusy || !this.running) return
    const targetId = this.selectedContainerId
    this.set('containerInteraction', { targetId, kind: 'container', status: 'pending', message: 'Inspecting container…' })
    try { await this.client.useTarget(targetId) }
    catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('containerInteraction', { targetId, kind: 'container', status: 'rejected', message: error.message })
      }
    }
  }

  @action
  takeContainerItem(itemId) { return this.runItemTransfer('take', itemId) }

  @action
  takeAllContainerItems() { return this.runItemTransfer('take-all') }

  @action
  putInventoryItem(itemId) { return this.runItemTransfer('put', itemId) }

  async runItemTransfer(kind, itemId) {
    const interaction = this.containerInteraction
    const taking = kind !== 'put', batch = kind === 'take-all'
    const sourceItems = taking ? interaction?.items : this.inventory?.items
    const supported = batch ? this.canTakeAllFromSelectedContainer :
      taking ? interaction?.canTake === true : this.canPutInSelectedContainer
    if (!this.running || this.transferControlsBusy || !supported || interaction?.inspected !== true ||
        interaction.status !== 'completed' || interaction.targetId !== this.selectedContainerId ||
      !(batch ? sourceItems?.length > 0 : sourceItems?.some(item => item.id === itemId && ['Generic', 'Key'].includes(item.type)))) return
    const request = { kind, targetId: interaction.targetId, itemId }
    this.set('transferPending', request)
    try {
      if (batch) await this.client.takeAllItems(request.targetId)
      else await this.client[taking ? 'takeItem' : 'putItem'](request.targetId, itemId)
      // Both owner lists come from the client's private, validated response.
      // The button never removes a row or creates an inventory entry itself.
    } catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('containerInteraction', { targetId: request.targetId, kind: 'container',
          status: 'rejected', message: error.message })
      }
    } finally {
      if (!this.isDestroying && !this.isDestroyed && this.transferPending === request) this.set('transferPending', null)
    }
  }

  @action
  selectGroundItem(event) { this.set('selectedGroundId', event.target.value) }

  @action
  pickupGroundItem() { return this.runGroundCommand('pickup', this.selectedGroundId) }

  @action
  dropInventoryItem(itemId) { return this.runGroundCommand('drop', itemId) }

  async runGroundCommand(action, itemId) {
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
        this.set('ground', { action, status: 'rejected', message: error.message })
      }
    } finally {
      if (!this.isDestroying && !this.isDestroyed && this.groundPending === request) this.set('groundPending', null)
    }
  }

  focusConversation() {
    if (this.isDestroying || this.isDestroyed || !this.running || !this.conversationReady) return
    const content = this.element?.querySelector('[data-conversation-content]')
    content?.scrollIntoView({ block: 'nearest' })
    content?.focus({ preventScroll: true })
  }

  @action
  selectConversation(event) { this.set('selectedConversationId', event.target.value) }

  @action
  beginConversation() { return this.runConversationCommand('begin', this.selectedConversationId) }

  @action
  replyConversation(optionId) { return this.runConversationCommand('reply', optionId) }

  async runConversationCommand(action, value) {
    if (!this.running || this.controlsBusy || (action === 'begin'
      ? !this.conversationTargets.some(target => target.id === value)
      : !this.conversationReady || !this.conversation?.options?.some(option => option.id === value))) return
    const request = { action, value }
    this.setProperties({ conversationPending: request, conversation: { ...this.conversation, status: 'pending',
      message: action === 'begin' ? 'Approaching character…' : 'Sending reply…' } })
    try {
      await this.client[action === 'begin' ? 'beginConversation' : 'replyConversation'](value)
      // Dialogue choices and quest progress arrive only through private client
      // events. The component never infers them from inventory or button intent.
    } catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('conversation', { ...this.conversation, status: 'rejected', message: error.message, options: [] })
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
    this.setProperties({ journalPending: request, journal: { ...this.journal, status: 'pending', message: 'Refreshing journal…' } })
    try { await this.client.refreshJournal() }
    catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('journal', { ...this.journal, status: 'rejected', message: error.message })
      }
    } finally {
      if (!this.isDestroying && !this.isDestroyed && this.journalPending === request) this.set('journalPending', null)
    }
  }

  @action
  async refreshCharacter() {
    if (!this.running || this.journalControlsBusy) return
    const request = {}
    this.setProperties({ characterPending: request, character: { ...this.character, status: 'pending', message: 'Refreshing character…' } })
    try { await this.client.refreshCharacter() }
    catch (error) {
      if (!this.isDestroying && !this.isDestroyed && this.running) {
        this.set('character', { ...this.character, status: 'rejected', message: error.message })
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
        this.set('pause', { ...this.pause, status: 'rejected', message: error.message })
      }
    }
  }

  async runCheckpoint(action) {
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
        this.set('checkpoint', { action, status: 'rejected', message: error.message })
      }
    }
  }

  removeInteractionListeners() {
    if (!this.client) return
    if (this.onInteractionsUpdated) this.client.events.off('World:InteractionsUpdated', this.onInteractionsUpdated)
    if (this.onInteractionUpdated) this.client.events.off('Player:InteractionUpdated', this.onInteractionUpdated)
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
    window.removeEventListener('resize', this.onWindowResize)
    const client = this.client || this.gameEngine?.client
    this.removeInteractionListeners()
    if (client) {
      if (this.onRuntimeError) client.events.off('Game:Error', this.onRuntimeError)
      client.stop()
    }
    this.stopLocalServer?.()?.catch(error => console.error('Local server shutdown failed', error))
    super.willDestroyElement(...arguments)
  }
}

export default setComponentTemplate(template, GameRender)
