exports.widget = {
  type: 'window',
  sprite: 'IntBotom',
  align: 'center-bottom',
  visible: true,
  style: 'border-radius: 10px 10px 0px 0px;',

  components: {
    'healthBarBg': {
      type: 'image',
      position: [14, 31],
      sprite: 'CLRVIAL'
    },

    'healthBar': {
      type: 'gauge',
      position: [15, 24],
      size: [28, 96],
      sprite: 'REDVIAL',
      orientation: 'vertical',
      value: 100,
      max: 100,
      min: 0,

      animation: {
        duration: 1000,
        repeat: -1,
      },
    },
    'healthPoints': {
      type: 'text',
      position: [15, 133],
      size: [28, 19],
    },
    'goldIcon': {
      type: 'icon',
      position: [61, 68],
      size: [22, 22],
    },
    'goldNumber': {
      type: 'text',
      position: [95, 70],
    },
    'combatBtn': {
      type: 'button',
      position: [86, 16],
      sprite: 'CombatButton',
    },
    'lastSlot1': {
      type: 'slot-button',
      position: [68, 107],
      size: [31, 31],
    },
    'lastSlot2': {
      type: 'slot-button',
      position: [113, 107],
      size: [31, 31],
    },
    'spellBtn2': {
      type: 'button',
      position: [161, 2],
      size: [35, 36],
      sprite: 'MagickWeaponButt',
      style: 'background-size: cover; background-blend-mode: screen',
    },

    'hotSlot0': {
      type: 'slot-button',
      position: [199, 4],
      size: [28, 28],
      //"sprite": "HKSlt0"
    },
    'hotSlot1': {
      type: 'slot-button',
      position: [238, 4],
      size: [28, 28],
      //"sprite": "HKSlt1"
    },
    'hotSlot2': {
      type: 'slot-button',
      position: [276, 4],
      size: [28, 28],
      //"sprite": "HKSlt2"
    },
    'hotSlot3': {
      type: 'slot-button',
      position: [316, 4],
      size: [28, 28],
      //"sprite": "HKSlt3"
    },
    'hotSlot4': {
      type: 'slot-button',
      position: [354, 4],
      size: [28, 28],
      //"sprite": "HKSlt4"
    },

    'hotSlot5': {
      type: 'slot-button',
      position: [418, 4],
      size: [28, 28],
      //"sprite": "HKSlt5"
    },
    'hotSlot6': {
      type: 'slot-button',
      position: [456, 4],
      size: [28, 28],
      //"sprite": "HKSlt6"
    },
    'hotSlot7': {
      type: 'slot-button',
      position: [496, 4],
      size: [28, 28],
      //"sprite": "HKSlt7"
    },
    'hotSlot8': {
      type: 'slot-button',
      position: [534, 4],
      size: [28, 28],
      //"sprite": "HKSlt8"
    },
    'hotSlot9': {
      type: 'slot-button',
      position: [574, 4],
      size: [28, 28],
      //"sprite": "HKSlt9"
    },

    'skillsBtn': {
      type: 'button',
      position: [694, 14],
      sprite: 'SkillsButton',
    },
    'spellBtn': {
      type: 'button',
      position: [648, 52],
      sprite: 'SpellsButton',
    },
    'schemaBtn': {
      type: 'button',
      position: [694, 98],
      sprite: 'SchematicsButton',
    },
    'fatigueBarBg': {
      type: 'image',
      position: [754, 24],
      sprite: 'CLRVIAL',
    },

    'fatigueBar': {
      type: 'gauge',
      position: [754, 24],
      size: [28, 96],
      sprite: 'BLUVIAL',

      orientation: 'vertical',
      value: 100,
      max: 100,
      min: 0,

      animation: {
        duration: 1000,
        repeat: -1,
      },

    },
    'fatiguePoints': {
      type: 'text',
      position: [754, 133],
      size: [28, 19],
    },

    'xpGauge': {
      type: 'gauge',
      position: [216, 47],
      sprite: 'XPGaugeMag',
    },

    'xpPipes': {
      type: 'window',
      position: [211, 37],
      components: {
        'xp1': {
          type: 'icon',
          position: [0, 0],
          sprite: 'XPPip1',
        },
        'xp2': {
          type: 'icon',
          position: [38, 0],
          sprite: 'XPPip2',
        },
        'xp3': {
          type: 'icon',
          position: [76, 0],
          sprite: 'XPPip3',
        },
        'xp4': {
          type: 'icon',
          position: [116, 0],
          sprite: 'XPPip4',
        },
        'xp5': {
          type: 'icon',
          position: [154, 0],
          sprite: 'XPPip5',
        },
        'xp6': {
          type: 'icon',
          position: [192, 0],
          sprite: 'XPPip6',
        },
        'xp7': {
          type: 'icon',
          position: [230, 0],
          sprite: 'XPPip7',
        },
        'xp8': {
          type: 'icon',
          position: [268, 0],
          sprite: 'XPPip8',
        },
        'xp9': {
          type: 'icon',
          position: [306, 0],
          sprite: 'XPPip9',
        },
        'xp10': {
          type: 'icon',
          position: [344, 0],
          sprite: 'XPPip10',
        },
      },
    },

    'apBar': {
      type: 'image',
      position: [226, -30],
      sprite: 'APBar',
    },

  },
};
