import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'

class GuiInventorySlot extends GuiWidget {}

setComponentTemplate(template, GuiInventorySlot)
export default GuiInventorySlot
