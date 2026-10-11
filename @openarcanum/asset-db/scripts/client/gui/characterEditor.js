module.exports = {
  type: `window`,
  sprite: `CharMaint`,
  position: `center`,
  visible: false,
  options: {
    toolbar: true,
    title: `Character Editor`
  },

  events: {
    created() {
      //this.emitEvent(`:switchTab`, `skillsTabBtn`)
    }
  },

  /*
  PCWinCvr
LnsBart
LnsLoot
LnsPapr
CharPCC
SchmPCLens
OptionsPCLens
SaveLoadPCLens
   */

  listeners: {
    'inventory:show': event => {
      this.toggle()
    },

    ':switchTab': id => {
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
    alignIndicator: {
      type: `image`,
      sprite: `align`,
      position: [20, 179],
      //size: [60, 60],
      style: {
        backgroundRepeat: `no-repeat`
      },

      events: {
        click() {
          this.changeFrame(Math.randomInt(0, 20))
        }
      }
    },

    skillsTabBtn: {
      options: {
        tooltip: `Skills`
      },
      type: `button`,
      position: [527, 11],
      sprite: `charCommonSkills`,
      events: {
        click() {
          this.emitEvent(`characterEditor:switchTab`, `skillsTab`)
        }
      }
    },

    skillsTab: {
      type: `group`,
      position: [503, 62],
      sprite: `SkillsWindow`,
      events: {
        created() {
          let x = 21

          // top
          const disciplines = {
            Combat: {
              button: `CombatBut`
            },
            Thieving: {
              button: `ThievingBut`
            },
            Social: {
              button: `SocialBut`
            },
            Technological: {
              button: `TechnologicalBut`
            }
          }

          let i = 0
          for (let name in disciplines) {
            let item = disciplines[name]

            let model = this.createChild({
              id: `skillTabBtn${i}`,
              type: `button`,
              position: [x, 17],
              sprite: `${item.button}`,
              options: {
                tooltip: name
              }
            })

            x += 54
            i += 1
          }

          let props = [`Bow`, `Dodge`, `Melee`, `Throwing`]

          let y = 84
          for (let i = 0; i < props.length; i++) {
            let prop = props[i]

            let model = this.createChild({
              id: `skillTabGauge${i}`,
              type: `property-gauge`,
              position: [19, y],
              size: [200, 30],
              value: 100,
              options: {
                title: prop
              }
            })

            y += 66
          }
        }
      }
    },

    disciplinesTabBtn: {
      type: `button`,
      position: [595, 11],
      sprite: `SchematicsButton`,
      events: {
        click() {
          this.emitEvent(`characterEditor:switchTab`, `disciplinesTab`)
        }
      }
    },

    disciplinesTab: {
      type: `group`,
      position: [503, 62],
      sprite: `DisciplinesWindow`,
      events: {
        created() {}
      },

      components: {
        disciplinesGroup: {
          type: `group`,
          position: [0, 0],
          parent: `disciplinesTab`,

          events: {
            created() {
              let disciplines = {
                Herbology: {
                  sprite: `AnatomicalBut`,
                  button: `TTIHerb`
                },
                Electric: {
                  sprite: `ElectricalBut`,
                  button: `TTIElectric`
                },
                'Gun Smithy': {
                  sprite: `GunSmithyBut`,
                  button: `TTIGun`
                },
                Smithy: {
                  sprite: `SmithyBut`,
                  button: `TTISmithy`
                },
                Chemistry: {
                  sprite: `ChemistryBut`,
                  button: `TTIChem`
                },
                Explosives: {
                  sprite: `ExplosivesBut`,
                  button: `TTIExplosives`
                },
                Mechanical: {
                  sprite: `TechnologicalBut`,
                  button: `TTIMechanical`
                },
                Therapeutics: {
                  sprite: `TherapeuticsBut`,
                  button: `TTITheru`
                }
              }

              this.currentDiscipline = disciplines[`Herbology`]

              let self = this
              this.switchTo = name => {
                this.currentDiscipline = disciplines[name]

                for (let i = 1; i <= 7; i++) {
                  let disciplineBtn = this.getChild(`disciplinesTabBtn${i}`)

                  disciplineBtn.setSprite(`${this.currentDiscipline.button}`)
                }
              }

              this.onDisciplineClick = index => {}

              let x = 10
              let y = 10
              let i = 0

              for (let name in disciplines) {
                let discipline = disciplines[name]

                if (i === 4) {
                  x = 36
                  y = 32
                }

                let model = this.createChild({
                  id: `${name}Switch`,
                  type: `button`,
                  position: [x, y],
                  sprite: `${discipline.sprite}`,
                  options: {
                    tooltip: name
                  },
                  events: {
                    click() {
                      self.switchTo(name)
                    }
                  }
                })

                x += 54
                i += 1
              }

              x = 7
              y = 95

              for (let i = 1; i <= 7; i++) {
                let model = this.createChild({
                  id: `disciplinesTabBtn${i}`,
                  type: `button`,
                  position: [x, y],
                  sprite: `${this.currentDiscipline.button}`,
                  events: {
                    click() {
                      self.onDisciplineClick(i)
                    }
                  }
                })

                this.createChild({
                  id: `disciplinesTabText${i}`,
                  type: `text`,
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
      type: `button`,
      position: [662, 11],
      sprite: `SpellsButton`,
      events: {
        click() {
          this.emitEvent(`characterEditor:switchTab`, `spellsTab`)
        }
      }
    },

    spellsTab: {
      type: `group`,
      position: [503, 62],
      sprite: `CharSpells`,
      components: {
        spellsGroup: {
          type: `group`,
          position: [13, 16],

          events: {
            created() {
              let colleges = {
                Conveyance: {
                  sprite: `SConveyance`
                },
                Divination: {
                  sprite: `SDivination`
                },
                Air: {
                  sprite: `SAir`
                },
                Earth: {
                  sprite: `SEarth`
                },
                Fire: {
                  sprite: `SFire`
                },
                Water: {
                  sprite: `SWater`
                },
                Force: {
                  sprite: `SForc`
                },
                Mental: {
                  sprite: `SMental`
                },
                Meta: {
                  sprite: `SMeta`
                },
                Morph: {
                  sprite: `smorph`
                },
                Nature: {
                  sprite: `SNature`
                },
                GoodNecro: {
                  sprite: `SGoodNecro`
                },
                EvilNecro: {
                  sprite: `SEvilNecro`
                },
                Phantasm: {
                  sprite: `sphantasm`
                },
                Summoning: {
                  sprite: `SSummoning`
                },
                Temporal: {
                  sprite: `STemporal`
                }
              }

              let self = this

              this.currentCollege = `Conveyance`

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
              let i = 0

              for (let name in colleges) {
                let college = colleges[name]

                if (i === 8) {
                  x = 12
                  y = 25
                }

                let model = this.createChild({
                  id: `${name}Switch`,
                  type: `button`,
                  position: [x, y],
                  sprite: `${college.sprite}`,
                  options: {
                    tooltip: name
                  },
                  events: {
                    click() {
                      self.switchTo(name)
                    }
                  }
                })

                x += 25
                i++
              }

              x = 5
              y = 67

              for (let i = 1; i <= 5; i++) {
                let college = colleges[this.currentCollege]

                let model = this.createChild({
                  id: `spellsTabBtn${i}`,
                  type: `button`,
                  position: [x, y],
                  sprite: `${college.sprite}${i}`,
                  events: {
                    click() {
                      self.onSpellClick(i)
                    }
                  }
                })

                this.createChild({
                  id: `spellsTabText${i}`,
                  type: `text`,
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
      type: `text`,
      position: [43, 196]
      //size: [100, 100]
    },

    magicApt: {
      type: `text`,
      position: [755, 65]
      //size: [100, 100]
    },

    techApt: {
      type: `text`,
      position: [755, 365]
      //size: [100, 100]
    },

    schemaSkillsTabBtn: {
      type: `button`,
      position: [754, 21],
      sprite: `charSchemSkills`,
      events: {
        click() {
          this.emitEvent(`schemaWin:toggle`)
        }
      }
    },

    derivedStatsLabel: {
      type: `text`,
      position: [54, 283]
      //size: [100, 100]
    },

    derivedStatsInfo: {
      type: `text`,
      position: [54, 295]
      //size: [100, 100]
    },

    resistanceLabel: {
      type: `text`,
      position: [326, 283]
      //size: [100, 100]
    },

    resistanceInfo: {
      type: `text`,
      position: [326, 283]
      //size: [100, 100]
    },

    strengthSpinner: {
      type: `number-spinner`,
      position: [170, 117],
      size: [75, 20]
    },

    constitutionSpinner: {
      type: `number-spinner`,
      position: [170, 157],
      size: [75, 20]
    },

    dexteritySpinner: {
      type: `number-spinner`,
      position: [170, 197],
      size: [75, 20]
    },

    beautySpinner: {
      type: `number-spinner`,
      position: [170, 237],
      size: [75, 20]
    },

    intelligenceSpinner: {
      type: `number-spinner`,
      position: [314, 117],
      size: [75, 20]
    },

    willpowerSpinner: {
      type: `number-spinner`,
      position: [314, 157],
      size: [75, 20]
    },

    perceptionSpinner: {
      type: `number-spinner`,
      position: [314, 197],
      size: [75, 20]
    },

    characterSpinner: {
      type: `number-spinner`,
      position: [314, 237],
      size: [75, 20]
    },

    healthSpinner: {
      type: `number-spinner`,
      position: [410, 144],
      size: [75, 20]
    },

    fatigueSpinner: {
      type: `number-spinner`,
      position: [410, 215],
      size: [75, 20]
    }
  }
}
