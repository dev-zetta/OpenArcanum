module.exports = {
  type: 'window',
  sprite: 'PDoll',
  align: 'left-center',
  visible: false,

  listeners: {
    'inventoryWin:toggle': () => {
      this.toggle()
    }
  },

  components: {
    lens: {
      type: 'image',
      position: [11, 9],
      sprite: 'OptionsPCLens'
    },
    attackIcon: {
      type: 'icon',
      position: [27, 320],
      sprite: 'TotalAttack'
    },
    defenseIcon: {
      type: 'icon',
      position: [255, 320],
      sprite: 'TotalDefens'
    },

    gauntletSlot: {
      type: 'slot-button',
      position: [55, 107],
      sprite: 'CVRGauntlet'
    },

    helmetSlot: {
      type: 'slot-button',
      position: [152, 107],
      sprite: 'CVRHelmet'
    },

    rintSlot: {
      type: 'slot-button',
      position: [247, 107],
      sprite: 'CVRRing1'
    },

    ringSlot2: {
      type: 'slot-button',
      position: [279, 107],
      sprite: 'CVRRing2'
    },

    medalionSlot: {
      type: 'slot-button',
      position: [247, 139],
      sprite: 'CVRMedalion'
    },

    weaponSlot: {
      type: 'slot-button',
      position: [23, 170],
      sprite: 'CVRWeapon'
    },

    armorSlot: {
      type: 'slot-button',
      position: [119, 171],
      sprite: 'CVRArmor'
    },

    shieldSlot: {
      type: 'slot-button',
      position: [247, 171],
      sprite: 'CVRShield'
    },

    bootSlot: {
      type: 'slot-button',
      position: [150, 331],
      sprite: 'CVRBoot'
    }
  }
}
