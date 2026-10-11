import { helper } from '@ember/component/helper'
import GuiButton from '../pods/components/gui-button/component'
import GuiChatWindow from '../pods/components/gui-chat-window/component'
import GuiCheckbox from '../pods/components/gui-checkbox/component'
import GuiDialogBubble from '../pods/components/gui-dialog-bubble/component'
import GuiDraggable from '../pods/components/gui-draggable/component'
import GuiGauge from '../pods/components/gui-gauge/component'
import GuiGoogleAuth from '../pods/components/gui-google-auth/component'
import GuiGroup from '../pods/components/gui-group/component'
import GuiIcon from '../pods/components/gui-icon/component'
import GuiImage from '../pods/components/gui-image/component'
import GuiInventory from '../pods/components/gui-inventory/component'
import GuiInventoryItem from '../pods/components/gui-inventory-item/component'
import GuiInventorySlot from '../pods/components/gui-inventory-slot/component'
import GuiMapLayer from '../pods/components/gui-map-layer/component'
import GuiMapView from '../pods/components/gui-map-view/component'
import GuiNumberSpinner from '../pods/components/gui-number-spinner/component'
import GuiPropertyGauge from '../pods/components/gui-property-gauge/component'
import GuiScreenRecord from '../pods/components/gui-screen-record/component'
import GuiText from '../pods/components/gui-text/component'
import GuiVideo from '../pods/components/gui-video/component'
import GuiWebview from '../pods/components/gui-webview/component'
import GuiWidget from '../pods/components/gui-widget/component'
import GuiWindow from '../pods/components/gui-window/component'

// Resolve only the component definitions authored in this application.
// Lazy getters also avoid reading definitions during circular template imports.
const components = {
  'gui-button': () => GuiButton,
  'gui-chat-window': () => GuiChatWindow,
  'gui-checkbox': () => GuiCheckbox,
  'gui-dialog-bubble': () => GuiDialogBubble,
  'gui-draggable': () => GuiDraggable,
  'gui-gauge': () => GuiGauge,
  'gui-google-auth': () => GuiGoogleAuth,
  'gui-group': () => GuiGroup,
  'gui-icon': () => GuiIcon,
  'gui-image': () => GuiImage,
  'gui-inventory': () => GuiInventory,
  'gui-inventory-item': () => GuiInventoryItem,
  'gui-inventory-slot': () => GuiInventorySlot,
  'gui-map-layer': () => GuiMapLayer,
  'gui-map-view': () => GuiMapView,
  'gui-number-spinner': () => GuiNumberSpinner,
  'gui-property-gauge': () => GuiPropertyGauge,
  'gui-screen-record': () => GuiScreenRecord,
  'gui-text': () => GuiText,
  'gui-video': () => GuiVideo,
  'gui-webview': () => GuiWebview,
  'gui-widget': () => GuiWidget,
  'gui-window': () => GuiWindow,
}

export function isWidgetComponent(definition) {
  return Object.values(components).some(resolve => resolve() === definition)
}

export default helper(function widgetComponent([name]) {
  const resolve = components[name]
  if (!resolve) throw new Error(`Unknown GUI component: ${name}`)
  return resolve()
})
