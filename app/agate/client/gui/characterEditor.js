module.exports = {
  type: 'window',
  sprite: 'CharMaint',
  align: 'left-center',
  visible: false,
  events: {
    created() {
      //this.emitEvent('characterEditor:switchTab', 'disciplinesTab')
    }
  },
  listeners: {
    'inventory:open': event => {
      this.toggle()
    },

    'characterEditor:switchTab': id => {
      if (this.currentTab) {
        this.currentTab.hide()
        this.currentTab.bringToBack()
      }

      let tab = this.getChild(id)
      tab.show()
      tab.bringToFront()

      this.currentTab = tab
    }
  },

  components: {
    skillsTabBtn: {
      type: 'button',
      position: [527, 11],
      sprite: 'charCommonSkills',
      events: {
        click() {
          //this.emitEvent('characterEditor:switchTab', 'skillsTab')
        }
      }
    },

    skillsTab: {
      type: 'group',
      position: [504, 62],
      sprite: 'SkillsWindow',
      events: {
        created() {
          let x = 21

          let buttons = [
            'CombatBut',
            'ThievingBut',
            'SocialBut',
            'TechnologicalBut'
          ]
          for (let i = 0; i < buttons.length; i++) {
            let item = buttons[i]

            let model = this.createChild({
              id: `skillTabBtn${i}`,
              type: 'button',
              position: [x, 17],
              sprite: `${item}`
            })

            x += 54
          }

          let props = ['Bow', 'Dodge', 'Melee', 'Throwing']

          let y = 84
          for (let i = 0; i < props.length; i++) {
            let prop = props[i]

            let model = this.createChild({
              id: `skillTabGauge${i}`,
              type: 'property-gauge',
              position: [19, y],
              options: {
                text: prop
              }
            })

            y += 66
          }
        }
      }
    },

    disciplinesTabBtn: {
      type: 'button',
      position: [595, 11],
      sprite: 'SchematicsButton',
      events: {
        click() {
          this.emitEvent('characterEditor:switchTab', 'disciplinesTab')
        }
      }
    },

    disciplinesTab: {
      type: 'group',
      position: [504, 62],
      sprite: 'DisciplinesWindow',
      components: {
        disciplinesGroup: {
          type: 'group',
          position: [0, 0],

          events: {
            created() {
              let disciplines = [
                {
                  name: 'Herbology',
                  sprite: 'AnatomicalBut',
                  button: 'TTIHerb'
                },
                {
                  name: 'Electric',
                  sprite: 'ElectricalBut',
                  button: 'TTIElectric'
                },
                {
                  name: 'Gun Smithy',
                  sprite: 'GunSmithyBut',
                  button: 'TTIGun'
                },
                {
                  name: 'Smithy',
                  sprite: 'SmithyBut',
                  button: 'TTISmithy'
                },
                {
                  name: 'Chemistry',
                  sprite: 'ChemistryBut',
                  button: 'TTIChem'
                },
                {
                  name: 'Explosives',
                  sprite: 'ExplosivesBut',
                  button: 'TTIExplosives'
                },
                {
                  name: 'Mechanical',
                  sprite: 'TechnologicalBut',
                  button: 'TTIMechanical'
                },
                {
                  name: 'Therapeutics',
                  sprite: 'TherapeuticsBut',
                  button: 'TTITheru'
                }
              ]

              let self = this

              this.currentDiscipline = disciplines[0]

              this.switchTo = index => {
                this.currentDiscipline = disciplines[index]

                for (let i = 1; i <= 7; i++) {
                  let disciplineBtn = this.getChild(`disciplinesTabBtn${i}`)

                  disciplineBtn.setSprite(`${disciplines[index].button}`)
                }
              }

              this.onDisciplineClick = index => {}

              let x = 10
              let y = 10

              for (let i = 0; i < disciplines.length; i++) {
                let discipline = disciplines[i]

                if (i == 4) {
                  x = 36
                  y = 32
                }

                let model = this.createChild({
                  id: `${discipline.name}Switch`,
                  type: 'button',
                  position: [x, y],
                  sprite: `${discipline.sprite}`,
                  events: {
                    click() {
                      self.switchTo(i)
                    }
                  }
                })

                x += 54
              }

              x = 7
              y = 95

              for (let i = 1; i <= 7; i++) {
                let model = this.createChild({
                  id: `disciplinesTabBtn${i}`,
                  type: 'button',
                  position: [x, y],
                  sprite: `${disciplines[0].button}`,
                  events: {
                    click() {
                      self.onDisciplineClick(i)
                    }
                  }
                })

                this.createChild({
                  id: `disciplinesTabText${i}`,
                  type: 'text',
                  position: [x + 50, y]
                })

                y += 32.5
              }
            }
          }
        }
      }
    },

    spellsTabBtn: {
      type: 'button',
      position: [662, 11],
      sprite: 'SpellsButton',
      events: {
        click() {
          this.emitEvent('characterEditor:switchTab', 'spellsTab')
        }
      }
    },

    spellsTab: {
      type: 'group',
      position: [504, 62],
      sprite: 'CharSpells',
      components: {
        spellsGroup: {
          type: 'group',
          position: [13, 16],

          events: {
            created() {
              let colleges = [
                'Conveyance',
                'Divination',
                'Air',
                'Earth',
                'Fire',
                'Water',
                'Force',
                'Mental',
                'Meta',
                'Morph',
                'Nature',
                'GoodNecro',
                'EvilNecro',
                'Phantasm',
                'Summoning',
                'Temporal'
              ]
              let sprites = [
                'SConveyance',
                'SDivination',
                'SAir',
                'SEarth',
                'SFire',
                'SWater',
                'SForc',
                'SMental',
                'SMeta',
                'smorph',
                'SNature',
                'SGoodNecro',
                'SEvilNecro',
                'sphantasm',
                'SSummoning',
                'STemporal'
              ]

              let self = this

              this.currentCollege = colleges[0]

              this.switchTo = name => {
                this.currentCollege = name

                for (let i = 1; i <= 5; i++) {
                  let spellBtn = this.getChild(`spellsTabBtn${i}`)

                  spellBtn.setSprite(`S${name}${i}`)
                }
              }

              this.onSpellClick = index => {}

              let x = 0
              let y = 0

              for (let i = 0; i < colleges.length; i++) {
                let college = colleges[i]

                if (i === 8) {
                  x = 12
                  y = 25
                }

                let model = this.createChild({
                  id: `${college}Switch`,
                  type: 'button',
                  position: [x, y],
                  sprite: `${sprites[i]}`,
                  events: {
                    click() {
                      self.switchTo(college)
                    }
                  }
                })

                x += 25
              }

              x = 5
              y = 67

              for (let i = 1; i <= 5; i++) {
                let model = this.createChild({
                  id: `spellsTabBtn${i}`,
                  type: 'button',
                  position: [x, y],
                  sprite: `${sprites[0]}${i}`,
                  events: {
                    click() {
                      self.onSpellClick(i)
                    }
                  }
                })

                this.createChild({
                  id: `spellsTabText${i}`,
                  type: 'text',
                  position: [x + 50, y],
                  events: {
                    click() {
                      self.onSpellClick(i)
                    }
                  }
                })

                y += 47.5
              }
            }
          }
        }
      }
    },

    alignmentValue: {
      type: 'text',
      position: [43, 196]
      //size: [100, 100]
    },

    magicApt: {
      type: 'text',
      position: [755, 65]
      //size: [100, 100]
    },

    techApt: {
      type: 'text',
      position: [755, 365]
      //size: [100, 100]
    },

    schemaSkillsTabBtn: {
      type: 'button',
      position: [754, 21],
      sprite: 'charSchemSkills'
    },

    derivedStatsLabel: {
      type: 'text',
      position: [54, 283]
      //size: [100, 100]
    },

    derivedStatsInfo: {
      type: 'text',
      position: [54, 295]
      //size: [100, 100]
    },

    resistanceLabel: {
      type: 'text',
      position: [326, 283]
      //size: [100, 100]
    },

    resistanceInfo: {
      type: 'text',
      position: [326, 283]
      //size: [100, 100]
    },

    strengthSpinner: {
      type: 'number-spinner',
      position: [170, 117]
    },

    constitutionSpinner: {
      type: 'number-spinner',
      position: [170, 157]
    },

    dexteritySpinner: {
      type: 'number-spinner',
      position: [170, 197]
    },

    beautySpinner: {
      type: 'number-spinner',
      position: [170, 237]
    },

    intelligenceSpinner: {
      type: 'number-spinner',
      position: [314, 117]
    },

    willpowerSpinner: {
      type: 'number-spinner',
      position: [314, 157]
    },

    perceptionSpinner: {
      type: 'number-spinner',
      position: [314, 197]
    },

    characterSpinner: {
      type: 'number-spinner',
      position: [314, 237]
    },

    healthSpinner: {
      type: 'number-spinner',
      position: [410, 144]
    },

    fatigueSpinner: {
      type: 'number-spinner',
      position: [410, 215]
    }
  }
}
