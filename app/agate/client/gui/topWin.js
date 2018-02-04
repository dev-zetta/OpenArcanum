exports.widget = {
  type: 'window',
  sprite: 'IntTop',
  align: 'center-top',
  visible: true,
  style: 'border-radius: 0px 0px 10px 10px;',

  components: {
    'debugText': {
      type: 'text',
      position: [0, 50],
      size: [100, 100]
    },

    'characterBtn': {
      type: 'button',
      position: [4, 1],
      sprite: 'CharBut',
      events: {
        onClick(event) { // this.getWidget('topWin').toggle();
          this.emitEvent('charWin:open');
        }
      }
    },
    'logbookBtn': {
      type: 'button',
      position: [41, 1],
      sprite: 'LogBut',
      events: {
        onClick(event) {
          this.emitEvent('logbookWin:open');
        }
      },
    },
    'mapBtn': {
      type: 'button',
      position: [78, 1],
      sprite: 'TMapBut', /* WMapBut */
      events: {
        onClick(event) {
          this.emitEvent('mapWin:open');
        }
      }
    },
    'inventoryBtn': {
      type: 'button',
      position: [115, 1],
      sprite: 'InvnBut',
      events: {
        onClick(event) {
          this.emitEvent('openInventory');
        }
      }

    },
    'fateBtn': {
      type: 'button',
      position: [154, 6],
      sprite: 'tinybutt',
    },
    'fatePoints': {
      type: 'text',
      position: [190, 13],
    },

    'plugBtn1': {
      type: 'slot-button',
      position: [281, 3],
      sprite: 'SPPlugged1',
    },
    'plugBtn2': {
      type: 'slot-button',
      position: [331, 3],
      sprite: 'SPPlugged1',
    },
    'plugBtn3': {
      type: 'slot-button',
      position: [381, 3],
      sprite: 'SPPlugged1',
    },
    'plugBtn4': {
      type: 'slot-button',
      position: [431, 3],
      sprite: 'SPPlugged1',
    },
    'plugBtn5': {
      type: 'slot-button',
      position: [481, 3],
      sprite: 'SPPlugged1',
    },
    'sleepBtn': {
      type: 'button',
      position: [602, 6],
      sprite: 'tinybutt',
    },
    'timeProgress': {
      type: 'gauge',
      position: [648, 6],
    },
    'timeGauge': {
      type: 'gauge',
      position: [648, 4],
      sprite: 'Clktimestrip',
      size: [128, 29],
      orientation: 'horizontal',
      min: 0,
      max: 100
    },

    'loadSpinner': {
      type: 'image',
      sprite: 'LoadIndicator',
      position: [700, 100],
      animation: {
        duration: 1000,
        repeat: -1,
      },
    },

  },
};
/* topWin */
