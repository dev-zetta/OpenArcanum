import { setComponentTemplate } from '@ember/component'
import { computed } from '@ember/object'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'
import type { WidgetStyle } from '../../../types/widgets'

class GuiGauge extends GuiWidget {
  getMin(): number { return this.getOption('min') ?? 0 }
  getMax(): number { return this.getOption('max') ?? 100 }
  getOrientation() { return this.getOption('orientation') }
  getValue(): number { return this.value }
  setValue(value: unknown): void { this.set('value', Number(value)) }
  @computed('widget', 'sprite') get value(): number { return Number(this.widget.value) || 0 }
  set value(input: number) {
    const min = this.getMin(), max = this.getMax()
    const value = Math.min(max, Math.max(min, input))
    const percent = (max - min) * ((value - min) / 100)
    const style: WidgetStyle = {}
    if (this.sprite) {
      const frame = this.sprite.getFrame()
      if (this.getOrientation() === 'horizontal') style['background-position-x'] = `-${frame.width - frame.width / 100 * percent}px`
      else if (this.getOrientation() === 'vertical') style['background-position-y'] = `${frame.height - frame.height / 100 * percent}px`
      style['background-repeat'] = 'no-repeat'
    }
    this.setStyle(style)
    const placeholder = this.getOption('placeholder')
    if (placeholder) this.getWidget(placeholder)?.setValue(value)
    this.widget.set('value', value)
  }
  click(): boolean { this.setValue(Math.floor(Math.random() * this.getMax()) + this.getMin()); return false }
}
setComponentTemplate(template, GuiGauge)
export default GuiGauge
