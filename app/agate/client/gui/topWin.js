module.exports = {
  type: 'window',
  sprite: 'IntTop',
  align: 'center-top',
  visible: true,
  style: { borderRadius: '0px 0px 10px 10px' },

  components: {
    debugText: {
      type: 'text',
      position: [0, 50],
      size: [100, 100]
    },

    characterBtn: {
      type: 'button',
      position: [4, 1],
      sprite: 'CharBut',
      events: {
        click(event) {
          this.emitEvent('characterEditor:toggle')
        }
      }
    },
    logbookBtn: {
      type: 'button',
      position: [41, 1],
      sprite: 'LogBut',
      events: {
        click(event) {
          this.emitEvent('bookWin:toggle')
        }
      }
    },
    mapBtn: {
      type: 'button',
      position: [78, 1],
      sprite: 'TMapBut' /* WMapBut */,
      events: {
        click(event) {
          this.emitEvent('mapWin:toggle')
        }
      }
    },
    inventoryBtn: {
      type: 'button',
      position: [115, 1],
      sprite: 'InvnBut',
      events: {
        click(event) {
          this.emitEvent('inventoryWin:toggle')
        }
      }
    },
    fateBtn: {
      type: 'button',
      position: [154, 6],
      sprite: 'tinybutt'
    },
    fatePoints: {
      type: 'text',
      position: [190, 13]
    },

    plugBtn1: {
      type: 'slot-button',
      position: [281, 3],
      sprite: 'SPPlugged1'
    },
    plugBtn2: {
      type: 'slot-button',
      position: [331, 3],
      sprite: 'SPPlugged1'
    },
    plugBtn3: {
      type: 'slot-button',
      position: [381, 3],
      sprite: 'SPPlugged1'
    },
    plugBtn4: {
      type: 'slot-button',
      position: [431, 3],
      sprite: 'SPPlugged1'
    },
    plugBtn5: {
      type: 'slot-button',
      position: [481, 3],
      sprite: 'SPPlugged1'
    },
    sleepBtn: {
      type: 'button',
      position: [602, 6],
      sprite: 'tinybutt'
    },
    timeProgress: {
      type: 'gauge',
      position: [648, 6]
    },
    timeGauge: {
      type: 'gauge',
      position: [648, 4],
      sprite: 'Clktimestrip',
      size: [128, 29],
      orientation: 'horizontal',
      min: 0,
      max: 100
    },
    loadSpinner: {
      type: 'image',
      sprite: 'LoadIndicator',
      position: [700, 100],
      animation: {
        duration: 1000,
        repeat: -1
      }
    }
  }
}
