import type { WidgetDefinition, WidgetInstance, TabbedWidget, BookWidget, DisciplineWidget, CollegeWidget, SchemaWidget, Discipline } from '../../WidgetTypes.cjs'
const definition = {
  type: `window`,
  sprite: `PDoll`,
  position: `left-center`,
  visible: false,
  options: {
    toolbar: true,
    title: `Character Inventory`
  },

  listeners: {
    'inventoryWin:toggle': function (this: WidgetInstance) {
      this.toggle()
    }
  },

  components: {
    lens2: {
      type: `image`,
      position: [11, 9],
      sprite: `CharPCC`
    },
    attackIcon: {
      type: `icon`,
      position: [27, 320],
      sprite: `TotalAttack`
    },
    defenseIcon: {
      type: `icon`,
      position: [255, 320],
      sprite: `TotalDefens`
    },

    gauntletSlot: {
      type: `inventory-slot`,
      position: [55, 107],
      sprite: `CVRGauntlet`
    },

    helmetSlot: {
      type: `inventory-slot`,
      position: [152, 107],
      sprite: `CVRHelmet`
    },

    rintSlot: {
      type: `inventory-slot`,
      position: [247, 107],
      sprite: `CVRRing1`
    },

    ringSlot2: {
      type: `inventory-slot`,
      position: [279, 107],
      sprite: `CVRRing2`
    },

    medalionSlot: {
      type: `inventory-slot`,
      position: [247, 139],
      sprite: `CVRMedalion`
    },

    weaponSlot: {
      type: `inventory-slot`,
      position: [23, 170],
      sprite: `CVRWeapon`
    },

    armorSlot: {
      type: `inventory-slot`,
      position: [119, 171],
      sprite: `CVRArmor`
    },

    shieldSlot: {
      type: `inventory-slot`,
      position: [247, 171],
      sprite: `CVRShield`
    },

    bootSlot: {
      type: `inventory-slot`,
      position: [150, 331],
      sprite: `CVRBoot`
    }
  }
} satisfies WidgetDefinition

export = definition
