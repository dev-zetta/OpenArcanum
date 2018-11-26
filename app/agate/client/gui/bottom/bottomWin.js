module.exports = {
  type: `window`,
  sprite: `IntBotom`,
  position: `center-bottom`,
  visible: true,
  style: { borderRadius: `10px 10px 0px 0px`},

  listeners: {
    ':switchDialog': id => {
      if (this.currentTab) {
        this.currentTab.hide()
        this.currentTab.bringToBack()
      }

      this.send(`playAudio`, `aaa`)

      let tab = this.getChild(id)
      tab.show()
      tab.bringToFront()

      this.currentTab = tab
    }
  },

  components: {
    healthBarBg: {
      type: `image`,
      position: [13.5, 31],
      size: [28, 90],
      sprite: `CLRVIAL`
    },

    healthBar: {
      type: `gauge`,
      position: [15, 24],
      size: [28, 96],
      sprite: `REDVIAL`,

      value: 100,

      options: {
        placeholder: `healthPoints`,
        orientation: `vertical`,

        max: 100,
        min: 0
      },

      animation: {
        duration: 1000,
        repeat: -1
      }
    },
    healthPoints: {
      type: `text`,
      position: [15, 133],
      size: [28, 19],
      value: 100,
      style: {
        textAlign: `center`,
        fontSize: `14px`,
        lineHeight: `17px`
      }
    },
    goldIcon: {
      type: `icon`,
      position: [61, 68],
      size: [22, 22]
    },
    goldNumber: {
      type: `text`,
      position: [95, 70]
    },
    combatBtn: {
      type: `button`,
      position: [86, 16],
      sprite: `CombatButton`
    },

    lastSlot1: {
      type: `inventory-slot`,
      position: [68, 107],
      size: [31, 31]
    },
    lastSlot2: {
      type: `inventory-slot`,
      position: [113, 107],
      size: [31, 31]
    },
    spellBtn2: {
      type: `button`,
      position: [161, 2],
      size: [35, 36],
      sprite: `MagickWeaponButt`,
      style: { backgroundSize: `cover`, backgroundBlendMode: `screen` }
    },

    hotSlots: {
      type: `inventory`,
      position: [197, 4],
      size: [406, 31],
      style: {},
      options: {
        type: 'slots',
        slotSize: 1,
        connectWith: [`inventory`]
      },
      listeners: {
        'sortBtn:click': () => {
          // get current dragged item
        },
        'dropBtn:click': () => {}
      },
      methods: {
        createSlots() {
          let size = [31, 31]

          this.addSlots({
            hotSlot0: {
              position: [0, 0],
              size
              //"sprite": "HKSlt0"
            },
            hotSlot1: {
              position: [39, 0],
              size
              //"sprite": "HKSlt1"
            },
            hotSlot2: {
              position: [77, 0],
              size
              //"sprite": "HKSlt2"
            },
            hotSlot3: {
              position: [117, 0],
              size
              //"sprite": "HKSlt3"
            },
            hotSlot4: {
              position: [155, 0],
              size
              //"sprite": "HKSlt4"
            },

            hotSlot5: {
              position: [219, 0],
              size
              //"sprite": "HKSlt5"
            },
            hotSlot6: {
              position: [257, 0],
              size
              //"sprite": "HKSlt6"
            },
            hotSlot7: {
              position: [297, 0],
              size
              //"sprite": "HKSlt7"
            },
            hotSlot8: {
              position: [335, 0],
              size
              //"sprite": "HKSlt8"
            },
            hotSlot9: {
              position: [375, 0],
              size
              //"sprite": "HKSlt9"
            }
          })
        }
      }
    },

    skillsBtn: {
      type: `button`,
      position: [693, 15],
      sprite: `SkillsButton`,
      events: {
        click() {
          this.emitEvent(`bottomWin:switchDialog`, `skillsWin`)
        }
      }
    },
    spellBtn: {
      type: `button`,
      position: [649, 53],
      sprite: `SpellsButton`,
      events: {
        click() {
          this.emitEvent(`bottomWin:switchDialog`, `spellsWin`)
        }
      }
    },
    schemaBtn: {
      type: `button`,
      position: [693, 98],
      sprite: `SchematicsButton`,
      events: {
        click() {
          this.emitEvent(`bottomWin:switchDialog`, `schematicWin`)
        }
      }
    },

    fatigueBarBg: {
      type: `image`,
      position: [753.5, 31],
      size: [28, 90],
      sprite: `CLRVIAL`
    },

    fatigueBar: {
      type: `gauge`,
      position: [755, 24],
      size: [28, 96],
      sprite: `BLUVIAL`,

      value: 100,

      options: {
        placeholder: `fatiguePoints`,
        orientation: `vertical`,

        max: 100,
        min: 0
      },

      animation: {
        duration: 1000,
        repeat: -1
      }
    },
    fatiguePoints: {
      type: `text`,
      position: [754, 133],
      size: [28, 19],
      value: 100,
      style: {
        textAlign: `center`,
        fontSize: `14px`,
        lineHeight: `17px`
      }
    },

    xpGauge: {
      type: `gauge`,
      position: [216, 47],
      sprite: `XPGaugeMag`
    },

    xpPipes: {
      type: `group`,
      position: [211, 37],
      events: {
        created() {
          let items = [0, 38, 76, 116, 154, 192, 230, 268, 306, 344]

          for (let i = 0; i < items.length; i++) {
            let item = items[i]

            let model = this.createChild({
              id: `xp${i}`,
              type: `icon`,
              position: [item, 0],
              sprite: `XPPip${i + 1}`
            })
          }
        }
      }
    },

    apBar: {
      type: `group`,
      position: [226, -30],
      sprite: `APBar`,
      events: {
        created() {
          let x = 22

          for (let i = 0; i < 20; i++) {
            let model = this.createChild({
              id: `ap${i}`,
              type: `icon`,
              position: [x, 10],
              sprite: `APGreen`
            })

            if (i % 5 === 4) {
              x += 19
            } else {
              x += 13
            }
          }
        }
      }
    }
  }
}
