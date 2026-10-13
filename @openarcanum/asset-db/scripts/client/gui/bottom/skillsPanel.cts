import type { WidgetDefinition, WidgetInstance, TabbedWidget, BookWidget, DisciplineWidget, CollegeWidget, SchemaWidget, Discipline } from '../../../WidgetTypes.cjs'
const definition = {
  parent: `bottomWin`,
  type: `group`,
  position: [196, 54],
  sprite: `DialogueWindow`,
  visible: false,

  components: {
    icon: {
      type: `icon`,
      position: [20, 20],
      sprite: `ShieldGeneralIcon`
    }
  }
} satisfies WidgetDefinition

export = definition
