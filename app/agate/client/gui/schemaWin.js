module.exports = {
  type: `window`,
  sprite: `SchematicBase`,
  position: `center`,
  visible: true,
  options: {
    toolbar: true,
    title: `Schematics`
  },

  events: {
    created() {
      let disciplines = {
        Herbology: {
          button: `AnatomicalTab`
        },
        Chemistry: {
          button: `ChemistryTab`
        },
        Electrical: {
          button: `ElectricalTab`
        },
        Explosives: {
          button: `ExplosivesTab`
        },
        GunSmithy: {
          button: `GunSmithyTab`
        },
        Mechanical: {
          button: `MechanicalTab`
        },
        Smithy: {
          button: `SmithyTab`
        },
        Therapeutics: {
          button: `TheraputicsTab`
        }
      }

      let x = 707
      let y = 17
      let i = 0
      //let selected = 0
      let selectedBtn = null

      let window = this
      for (let name in disciplines) {
        let discipline = disciplines[name]

        let model = this.createChild({
          id: `disciplineTabBtn${i}`,
          type: `button`,
          position: [x, y],
          sprite: `${discipline.button}`,
          options: {
            tooltip: name
          },
          events: {
            click() {
              if (selectedBtn) {
                selectedBtn.toggle()
              }

              //selected = name
              selectedBtn = this
              selectedBtn.toggle()

              window.showTab(name)
            }
          }
        })

        y += 45
        i += 1
      }

      this.schematicModel = this.getDatabase().getModel(`Schematic`)
      this.currentDiscipline = `Herbology`
      this.switchToType(`learned`)
    }
  },

  methods: {
    showTab(caller, name) {
      this.schematics = this.schematicModel.filtered(
        `discipline = "${name}" AND type = "${this.schematicType}"`
      )
      // console.error(name, this.schematics, this.schematicType)

      this.pageIndex = 0
      this.showSchematic(this.pageIndex)

      this.currentDiscipline = name
    },

    showSchematic(caller, index) {
      let schematic = this.schematics[index]

      this.getChild(`schemeTitle`).setValue(schematic.description.name)
      this.getChild(`schemeDescription`).setValue(
        schematic.description.description
      )

      let url = AGate.getGfxUrl(`Interface`)
      this.getChild(`schemeImage`).setSprite(`${url}/${schematic.sprite}`)
    },

    nextPage(caller) {
      if (this.pageIndex < this.schematics.length - 1) {
        this.pageIndex += 1
        this.showSchematic(this.pageIndex)
      }
    },

    previousPage(caller) {
      if (this.pageIndex > 0) {
        this.pageIndex -= 1
        this.showSchematic(this.pageIndex)
      }
    },

    switchToType(caller, type) {
      this.schematicType = type
      this.showTab(this.currentDiscipline)
    }
  },

  components: {
    lens: {
      type: `icon`,
      position: [50, 26],
      sprite: `SchmPCLens`
    },

    nextBtn: {
      type: `button`,
      position: [685, 16],
      sprite: `SchmRArrow`,
      events: {
        click() {
          this.callComponent(`schemaWin`, `nextPage`)
        }
      }
    },

    prevBtn: {
      type: `button`,
      position: [206, 16],
      sprite: `SchmLArrow`,
      events: {
        click() {
          this.callComponent(`schemaWin`, `previousPage`)
        }
      }
    },

    switchToLearnedBtn: {
      type: `button`,
      position: [29, 160],
      sprite: `BGRNBUT`,
      events: {
        click() {
          this.callComponent(`schemaWin`, `switchToType`, `learned`)
        }
      }
    },

    switchToFoundBtn: {
      type: `button`,
      position: [29, 248],
      sprite: `BGRNBUT`,
      events: {
        click() {
          this.callComponent(`schemaWin`, `switchToType`, `found`)
        }
      }
    },

    combineBtn: {
      type: `button`,
      position: [76, 324],
      sprite: `CombineButt`
    },

    combineIndicator: {
      type: `image`,
      position: [43, 338],
      sprite: `CombineIndicator3`
    },

    schemeBlank: {
      type: `image`,
      position: [240, 146],
      sprite: `Blankscheme`
    },

    schemeImage: {
      type: `image`,
      position: [240, 146],
      sprite: `Schargedring`
    },

    schemeItem1: {
      type: `image`,
      position: [579, 181],
      sprite: `SchemHaveItem`
    },

    schemeItem1Ico: {
      type: `icon`,
      position: [579, 181],
      size: [30, 30]
    },

    schemeItem2: {
      type: `image`,
      position: [579, 277],
      sprite: `SchemHaveItem`
    },

    schemeTitle: {
      type: `text`,
      position: [245, 30],
      style: {
        color: `black`,
        fontSize: `2rem`
      }
    },

    schemeDescription: {
      type: `text`,
      position: [220, 68],
      size: [475, 200],
      style: {
        color: `black`
      }
    }
  }
}
