import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'
import type { GuiEntity } from '../../../types/widgets'

class GuiInventoryItem extends GuiWidget {
  classNames = ['gui-widget', 'gui-inventory-item', 'draggable-source']
  entity: GuiEntity | null = null
  applySprite(): void {}
  setEntity(entity: GuiEntity): void {
    this.entity = entity
    // Inventory art selection is retained for the authored widget renderer.
    this.getClient().getGfxPath(entity.Item ? entity.Item.inventory : entity.Visual?.current)
  }
}
setComponentTemplate(template, GuiInventoryItem)
export default GuiInventoryItem
