import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'

class GuiIcon extends GuiWidget {}

export default setComponentTemplate(template, GuiIcon)
