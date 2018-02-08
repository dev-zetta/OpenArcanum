exports.widget = {
  type: 'window',
  sprite: 'IntBotom',
  align: 'center-bottom',
  visible: true,
  style: 'border-radius: 10px 10px 0px 0px;',

  components: {
    'healthBarBg': {
      type: 'image',
      position: [13.5, 31],
      size: [28, 90],
      sprite: 'CLRVIAL'
    },

    'healthBar': {
      type: 'gauge',
      position: [15, 24],
      size: [28, 96],
      sprite: 'REDVIAL',

      value: 100,

      options: {
        placeholder: 'healthPoints',
        orientation: 'vertical',

        max: 100,
        min: 0,
      },

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
      position: [693, 15],
      sprite: 'SkillsButton',
    },
    'spellBtn': {
      type: 'button',
      position: [649, 53],
      sprite: 'SpellsButton',
    },
    'schemaBtn': {
      type: 'button',
      position: [693, 98],
      sprite: 'SchematicsButton',
    },

    'fatigueBarBg': {
      type: 'image',
      position: [753.5, 31],
      size: [28, 90],
      sprite: 'CLRVIAL'
    },

    'fatigueBar': {
      type: 'gauge',
      position: [755, 24],
      size: [28, 96],
      sprite: 'BLUVIAL',

      value: 100,

      options: {
        placeholder: 'fatiguePoints',
        orientation: 'vertical',

        max: 100,
        min: 0,
      },

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
      type: 'group',
      position: [211, 37],
      events: {
        created() {
          let items = [0, 38, 76, 116, 154, 192, 230, 268, 306, 344];

          for (let i = 0; i < items.length; i++) {
            let item = items[i];

            let model = this.createChild({
              id: `xp${i}`,
              type: 'icon',
              position: [item, 0],
              sprite: `XPPip${i + 1}`

            });
          }

        }
      },
    },

    'apBar': {
      type: 'group',
      position: [226, -30],
      sprite: 'APBar',
      events: {
        created() {
          let x = 22;

          for (let i = 0; i < 20; i++) {
            let model = this.createChild({
              id: `ap${i}`,
              type: 'icon',
              position: [x, 10],
              sprite: `APGreen`

            });

            if (i % 5 == 4)
              x += 19;
            else x += 13;
          }

        }
      }

    },

  },
};
