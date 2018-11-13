module.exports = {
  //parent: 'middleWin',
  type: `window`,
  sprite: `Inventor`,
  position: `right-center`,
  visible: true,
  options: {
    toolbar: true,
    title: `Backpack Inventory`
  },

  listeners: {
    'plugSlots:created': () => {
      //this.callComponent(`plugSlots`, `createSlots`)
    },

    'hotSlots:created': () => {
      console.error('dfdfd')
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
          this.addItems({
            test: {
              sprite: `MagicksIcon`,
              size: [1, 2]
            },
            test2: {
              sprite: `MagicRingIcon`,
              size: [2, 2]
            },
            test3: {
              sprite: `MagicClothesIcon`
            },
            test4: {
              sprite: `MagicBowsIcon`
            },
            test5: {
              sprite: `MagicMeleeIcon`
            },
            test6: {
              sprite: `MagicBowsIcon`
            }
          })
        }
      }
    }
  }
}
