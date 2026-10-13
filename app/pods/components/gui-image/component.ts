import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'

class GuiImage extends GuiWidget {}

setComponentTemplate(template, GuiImage)
export default GuiImage
