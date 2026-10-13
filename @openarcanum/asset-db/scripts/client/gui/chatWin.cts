import type { WidgetDefinition, WidgetInstance, TabbedWidget, BookWidget, DisciplineWidget, CollegeWidget, SchemaWidget, Discipline } from '../../WidgetTypes.cjs'
const definition = {
  type: `window`,
  position: `center`,
  visible: false,
  size: [400, 500],
  style: { background: `#333`},
  options: {
    toolbar: true,
    title: `Chat`
  },

  components: {
    helloChat: {
      type: `chat-window`,
      position: [0, 0],
      size: [`100%`, `100%`]
    }
  }
} satisfies WidgetDefinition

export = definition
