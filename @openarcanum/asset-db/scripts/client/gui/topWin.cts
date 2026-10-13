import type { WidgetDefinition, WidgetInstance, TabbedWidget, BookWidget, DisciplineWidget, CollegeWidget, SchemaWidget, Discipline } from '../../WidgetTypes.cjs'
const definition = {
  type: `window`,
  sprite: `IntTop`,
  position: `center-top`,
  visible: true,
  style: { borderRadius: `0px 0px 10px 10px`},

  components: {
    debugText: {
      type: `text`,
      position: [0, 50],
      size: [100, 100]
    },

    characterBtn: {
      type: `button`,
      position: [4, 2],
      sprite: `CharBut`,
      events: {
        click(this: WidgetInstance, event: unknown) {
          this.emitEvent(`characterEditor:toggle`)
        }
      }
    },
    logbookBtn: {
      type: `button`,
      position: [41, 2],
      sprite: `LogBut`,
      events: {
        click(this: WidgetInstance, event: unknown) {
          this.emitEvent(`bookWin:toggle`)
        }
      }
    },
    mapBtn: {
      type: `button`,
      position: [78, 2],
      sprite: `TMapBut` /* WMapBut */,
      events: {
        click(this: WidgetInstance, event: unknown) {
          this.emitEvent(`mapWin:toggle`)
        }
      }
    },
    inventoryBtn: {
      type: `button`,
      position: [115, 2],
      sprite: `InvnBut`,
      events: {
        click(this: WidgetInstance, event: unknown) {
          this.emitEvent(`inventoryWin:toggle`)
        }
      }
    },
    fateBtn: {
      type: `button`,
      position: [154, 6],
      sprite: `tinybutt`
    },
    fatePoints: {
      type: `text`,
      position: [190, 13]
    },

    plugSlots: {
      type: `inventory`,
      position: [281, 3],
      size: [233, 33],
      style: {},
      options: {
        type: 'slots',
        slotSize: 1,
        connectWith: [`inventory`, `hotSlots`]
      },
      listeners: {
        'sortBtn:click': function (this: WidgetInstance) {
          // get current dragged item
        },
        'dropBtn:click': function (this: WidgetInstance) {}
      },
      methods: {
        createSlots(this: WidgetInstance, caller: WidgetInstance, ...args: unknown[]) {
          let size = [33, 33]
          this.addSlots({
            plugBtn1: {
              size,
              position: [0, 0],
              sprite: `SPPlugged1`
            },
            plugBtn2: {
              size,
              position: [50, 0],
              sprite: `SPPlugged1`
            },
            plugBtn3: {
              size,
              position: [100, 0],
              sprite: `SPPlugged1`
            },
            plugBtn4: {
              size,
              position: [150, 0],
              sprite: `SPPlugged1`
            },
            plugBtn5: {
              size,
              position: [200, 0],
              sprite: `SPPlugged1`
            }
          })
        }
      }
    },

    sleepBtn: {
      type: `button`,
      position: [602, 6],
      sprite: `tinybutt`
    },
    timeProgress: {
      type: `gauge`,
      position: [648, 6]
    },
    timeGauge: {
      type: `gauge`,
      position: [648, 4],
      sprite: `Clktimestrip`,
      size: [128, 29],
      orientation: `horizontal`,
      options: {
        orientation: `horizontal`,

        max: 100,
        min: 0
      },
      animation: {
        duration: 1000,
        repeat: -1
      }
    },
    loadSpinner: {
      type: `image`,
      sprite: `LoadIndicator`,
      position: [700, 100],
      animation: {
        duration: 1000,
        repeat: -1
      }
    }
  }
} satisfies WidgetDefinition

export = definition
