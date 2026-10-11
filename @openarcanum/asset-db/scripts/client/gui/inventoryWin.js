module.exports = {
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
    'topWin:created': () => {
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
        'sortBtn:click': () => {
          // get current dragged item
        },
        'dropBtn:click': () => {}
      },
      events: {
        created() {

          // Inventory contents will come from game state.
          // The legacy extracted-item demonstration is not distributed.

        }
      }
    }
  }
}
