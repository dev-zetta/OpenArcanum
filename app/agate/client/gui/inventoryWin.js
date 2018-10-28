module.exports = {
  //parent: 'middleWin',
  type: 'window',
  sprite: 'Inventor',
  align: 'right-center',
  visible: false,

  listeners: {
    openInventory(event) {
      console.log('test')
      this.toggle()
    }
  },

  components: {
    sortBtn: {
      type: 'button',
      sprite: 'LilGrnBut',
      position: [405, 198]
    },
    takeBtn: {
      type: 'button',
      sprite: 'UseBoxOFF',
      position: [346, 300]
    },
    dropBtn: {
      type: 'button',
      sprite: 'DropOFF',
      position: [346, 350]
    },
    inventor: {
      type: 'inventory',
      position: [9, 9],
      size: [315, 377],
      style: { border: '1px solid #fff', zIndex: 2 },
      components: {
        test: {
          type: 'image',
          sprite: 'MagicksIcon'
        },
        test2: {
          type: 'image',
          sprite: 'MagicRingIcon'
        },
        test3: {
          type: 'image',
          sprite: 'MagicClothesIcon'
        },
        test4: {
          type: 'image',
          sprite: 'MagicBowsIcon'
        },
        test5: {
          type: 'image',
          sprite: 'MagicMeleeIcon'
        },
        test6: {
          type: 'image',
          sprite: 'MagicBowsIcon'
        }
      }
    }
  }
}
