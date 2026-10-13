import type { WidgetDefinition, WidgetInstance, TabbedWidget, BookWidget, DisciplineWidget, CollegeWidget, SchemaWidget, Discipline } from '../../WidgetTypes.cjs'
const definition = {
  //parent: 'middleWin',
  type: `window`,
  sprite: `Inventor`,
  position: `right-center`,
  visible: false,
  options: {
    toolbar: true,
    title: `Backpack Inventory`
  },

  listeners: {
    'topWin:created': function (this: WidgetInstance) {
      this.callComponent(`plugSlots`, `createSlots`)
      this.callComponent(`hotSlots`, `createSlots`)
    }
  },

  components: {
    sortBtn: {
      type: `button`,
      sprite: `LilGrnBut`,
      position: [405, 198]
    },
    takeBtn: {
      type: `button`,
      sprite: `UseBoxOFF`,
      position: [346, 300]
    },
    dropBtn: {
      type: `button`,
      sprite: `DropOFF`,
      position: [346, 350]
    },
    inventory: {
      type: `inventory`,
      position: [10, 8],
      size: [315, 377],
      style: { zIndex: 2 },
      options: {
        slotSize: 31,
        connectWith: [`hotSlots`, `plugSlots`]
      },
      listeners: {
        'sortBtn:click': function (this: WidgetInstance) {
          // get current dragged item
        },
        'dropBtn:click': function (this: WidgetInstance) {}
      },
      events: {
        created(this: WidgetInstance) {

          // Inventory contents will come from game state.
          // The legacy extracted-item demonstration is not distributed.

        }
      }
    }
  }
} satisfies WidgetDefinition

export = definition
