import { setComponentTemplate } from '@ember/component'
import { service } from '@ember/service'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'
import GuiInventoryItem from '../gui-inventory-item'
import type DroppableService from '../../droppable/service'
import type Droppable from '../../droppable/droppable'
import type { InventorySlot, GuiEntity, WidgetDefinition } from '../../../types/widgets'

class GuiInventory extends GuiWidget {
  @service declare droppable: DroppableService
  instance?: Droppable
  slots: Record<string, InventorySlot> = {}
  click(): boolean { this.getParent()?.bringToFront(); return false }
  hasGrid(): Droppable | undefined { return this.instance }
  getGrid(): Droppable {
    if (!this.instance) this.instance = this.droppable.create('inventory', this.getOptions().type === 'slots' ? null : this.element as HTMLElement)
    return this.instance
  }
  addSlots(slots: Record<string, InventorySlot>): void {
    this.slots = slots
    const parentId = this.getId(), grid = this.getGrid(), slotSize = this.getOptions().slotSize ?? 31
    for (const [id, slot] of Object.entries(slots)) {
      const size = slot.size || [1, 1]
      const data: WidgetDefinition = {
        id: `${parentId}.${id}`, type: 'inventory-slot', size: [slotSize * size[0], slotSize * size[1]], sprite: slot.sprite, position: slot.position,
        events: { created() { if (this.element instanceof HTMLElement) grid.addDropzone(this.element) } }
      }
      this.createChild(data)
    }
  }
  addItems(items: Record<string, { size?: [number, number]; entity: GuiEntity }>): void {
    const parentId = this.getId(), slotSize = this.getOptions().slotSize ?? 31
    this.getGrid()
    for (const [id, item] of Object.entries(items)) {
      const size = item.size || [1, 1]
      this.createChild({
        id: `${parentId}.${id}`, type: 'inventory-item', size: [slotSize * size[0], slotSize * size[1]],
        events: { created() { if (this instanceof GuiInventoryItem) this.setEntity(item.entity) } }
      })
    }
  }
}
setComponentTemplate(template, GuiInventory)
export default GuiInventory
