import type { WidgetDefinition, WidgetInstance, TabbedWidget, BookWidget, DisciplineWidget, CollegeWidget, SchemaWidget, Discipline } from '../../WidgetTypes.cjs'
const definition = {
  type: `window`,
  position: `left-center`,
  visible: true,
  //size: [400, 400],
  style: { zIndex: 0, pointerEvents: 'none' },
  options: {
  },

  components: {

  }
} satisfies WidgetDefinition

export = definition
