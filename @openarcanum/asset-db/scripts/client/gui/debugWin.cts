import type { WidgetDefinition, WidgetInstance, TabbedWidget, BookWidget, DisciplineWidget, CollegeWidget, SchemaWidget, Discipline } from '../../WidgetTypes.cjs'
const definition = {
  type: `window`,
  position: `left-center`,
  visible: false,
  size: [400, 400],
  style: { background: `#333`},
  options: {
    toolbar: true,
    title: `Debug`
  },

  components: {
    recordPanel: {
      type: `screen-record`,
      position: [20, 20],
      size: [400, 400]
    },

    startBtn: {
      visible: true,
      type: `button`,
      position: [80, 200],
      prototype: ``,
      options: {
        label: `Start`
      },
      events: {
        click(this: WidgetInstance, event: unknown) {
          this.emitEvent(`game.reload`)
        }
      }
    },

    playBtn: {
      visible: true,
      type: `button`,
      position: [20, 200],
      prototype: ``,
      options: {
        label: `Play`
      },
      events: {
        click(this: WidgetInstance, event: unknown) {
          this.emitEvent(`showPlayer`)
        }
      }
    },

    startGameBtn: {
      visible: true,
      type: `button`,
      position: [20, 240],
      prototype: ``,
      options: {
        label: `Start Game`
      },
      events: {
        click(this: WidgetInstance, event: unknown) {

        }
      }
    }
  }
} satisfies WidgetDefinition

export = definition
