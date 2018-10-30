module.exports = {
  parent: 'bottomWin',
  type: 'group',
  position: [196, 54],
  visible: false,
  sprite: 'DialogueWindow',

  components: {
    currentIcon: {
      type: 'icon',
      position: [20, 20],
      sprite: 'IconGood'
    },

    name: {
      type: 'text',
      position: [100, 17],
      value: '0'
    },

    reaction: {
      type: 'text',
      position: [100, 32],
      value: '0'
    },

    healthBarBg2: {
      type: 'image',
      position: [100, 52],
      sprite: 'MesHealthBarEmpty'
    },

    fatigueBarBg2: {
      type: 'image',
      position: [100, 72],
      sprite: 'MesFatigueBarEmpty'
    },

    level: {
      type: 'text',
      position: [355, 32],
      value: '0'
    },

    healthPoints2: {
      type: 'text',
      position: [355, 48],
      value: '0'
    },

    fatiguePoints2: {
      type: 'text',
      position: [355, 66],
      value: '0'
    }
  }
}
