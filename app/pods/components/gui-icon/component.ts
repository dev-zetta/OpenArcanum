import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'

class GuiIcon extends GuiWidget {}

setComponentTemplate(template, GuiIcon)
export default GuiIcon
