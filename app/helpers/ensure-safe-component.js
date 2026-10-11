import { helper } from '@ember/component/helper'
import { isWidgetComponent } from './widget-component'

// Embroider recognizes this helper as the dynamic-component safety boundary.
// Modern Ember accepts a component class directly; only our imported registry
// is allowed, so neither arbitrary module names nor runtime strings can enter it.
export default helper(function ensureSafeComponent([definition]) {
  if (!isWidgetComponent(definition)) throw new Error('GUI component is not in the application registry.')
  return definition
})
