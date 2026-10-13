import type { WidgetDefinition, WidgetInstance, TabbedWidget, BookWidget, DisciplineWidget, CollegeWidget, SchemaWidget, Discipline } from '../../WidgetTypes.cjs'
const definition = {
  type: `window`,
  position: `left-center`,
  visible: false,
  size: [800, 400],
  style: { background: `#333`},
  options: {
    toolbar: true,
    title: `Video`
  },

  listeners: {
    'showPlayer': function (this: WidgetInstance) {
      this.show()
    }
  },

  components: {
    /*
    videoPlayer: {
      type: `video`,
      position: [0, 0],
      size: ['100%', '100%'],
      options: {
        src: 'asset://movies2/01138_1.mp4'
      }

    }*/
  }
} satisfies WidgetDefinition

export = definition
