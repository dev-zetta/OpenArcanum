exports.widget = {
  type: 'window',
  sprite: 'CharMaint',
  align: "left-center",
  visible: true,

  listeners: {
    openInventory(event) {
      this.toggle();
    }
  },

  components: {
    'skillTab': {
      type: 'window',
      position: [504, 62],
      sprite: 'CharSkillComm',
    },

    'techTab': {
      type: 'window',
      position: [504, 62],
      sprite: 'CharSkillTech',
    },

    'spellsTab': {
      type: 'window',
      position: [504, 62],
      sprite: 'CharSpells',
    },


    'alignmentValue': {
      type: 'text',
      position: [43, 196],
      //size: [100, 100]
    },

    'magicApt': {
      type: 'text',
      position: [755, 65],
      //size: [100, 100]
    },

    'techApt': {
      type: 'text',
      position: [755, 365],
      //size: [100, 100]
    },

    'skillsTabBtn': {
      type: 'button',
      position: [527, 11],
      sprite: 'charCommonSkills',
    },
    'schemaTabBtn': {
      type: 'button',
      position: [595, 11],
      sprite: 'SchematicsButton',
    },
    'spellTabBtn': {
      type: 'button',
      position: [662, 11],
      sprite: 'SpellsButton',
    },

    'schemaSkillsTabBtn': {
      type: 'button',
      position: [754, 21],
      sprite: 'charSchemSkills',
    },

    'derivedStatsLabel': {
      type: 'text',
      position: [54, 283],
      //size: [100, 100]
    },

    'derivedStatsInfo': {
      type: 'text',
      position: [54, 295],
      //size: [100, 100]
    },

    'resistanceLabel': {
      type: 'text',
      position: [326, 283],
      //size: [100, 100]
    },

    'resistanceInfo': {
      type: 'text',
      position: [326, 283],
      //size: [100, 100]
    },

    'strengthSpinner': {
      type: 'number-spinner',
      position: [170, 117]
    },

    'constitutionSpinner': {
      type: 'number-spinner',
      position: [170, 157]
    },

    'dexteritySpinner': {
      type: 'number-spinner',
      position: [170, 197]
    },

    'beautySpinner': {
      type: 'number-spinner',
      position: [170, 237]
    },



    'intelligenceSpinner': {
      type: 'number-spinner',
      position: [314, 117]
    },

    'willpowerSpinner': {
      type: 'number-spinner',
      position: [314, 157]
    },

    'perceptionSpinner': {
      type: 'number-spinner',
      position: [314, 197]
    },

    'characterSpinner': {
      type: 'number-spinner',
      position: [314, 237]
    },

    'healthSpinner': {
      type: 'number-spinner',
      position: [410, 144]
    },

    'fatigueSpinner': {
      type: 'number-spinner',
      position: [410, 215]
    },

  },

};
