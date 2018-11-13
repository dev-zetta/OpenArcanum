module.exports = {
  type: `window`,
  sprite: `SchematicBase`,
  position: `center`,
  visible: false,
  options: {
    toolbar: true,
    title: `Schematics`
  },

  events: {
    created() {
      let disciplines = {
        Anatomical: {
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
        Theraputics: {
          button: `TheraputicsTab`
        }
      }

      let x = 707
      let y = 17
      let i = 0
      let selected = 0
      let selectedBtn = null

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

              selected = name
              selectedBtn = this
              selectedBtn.toggle()
            }
          }

        })

        y += 45
        i += 1
      }
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
      sprite: `SchmRArrow`
    },

    prevBtn: {
      type: `button`,
      position: [206, 16],
      sprite: `SchmLArrow`
    },

    schemeBtn: {
      type: `button`,
      position: [29, 160],
      sprite: `BGRNBUT`
    },

    schemeBtn2: {
      type: `button`,
      position: [29, 248],
      sprite: `BGRNBUT`
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

    schemeItemIco: {
      type: `icon`,
      position: [579, 181],
      sprite: `SchemHaveItem`
    },

    schemeItem2: {
      type: `image`,
      position: [579, 277],
      sprite: `SchemHaveItem`
    }
  }
}
