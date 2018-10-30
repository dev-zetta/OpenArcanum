module.exports = {
  type: 'window',
  sprite: 'SchematicBase',
  align: 'center-center',
  visible: false,

  events: {
    created() {
      let disciplines = [
        {
          name: 'Anatomical',
          button: 'AnatomicalTab'
        },
        {
          name: 'Chemistry',
          button: 'ChemistryTab'
        },
        {
          name: 'Anatomical',
          button: 'ElectricalTab'
        },
        {
          name: 'Anatomical',
          button: 'ExplosivesTab'
        },
        {
          name: 'Anatomical',
          button: 'GunSmithyTab'
        },
        {
          name: 'Anatomical',
          button: 'MechanicalTab'
        },
        {
          name: 'Anatomical',
          button: 'SmithyTab'
        },
        {
          name: 'Anatomical',
          button: 'TheraputicsTab'
        }
      ]

      let x = 707
      let y = 17

      for (let i = 0; i < disciplines.length; i++) {
        let discipline = disciplines[i]

        let model = this.createChild({
          id: `disciplineTabBtn${i}`,
          type: 'button',
          position: [x, y],
          sprite: `${discipline.button}`
        })

        y += 45
      }
    }
  },

  components: {
    lens: {
      type: 'icon',
      position: [50, 26],
      sprite: 'SchmPCLens'
    },

    nextBtn: {
      type: 'button',
      position: [685, 16],
      sprite: 'SchmRArrow'
    },

    prevBtn: {
      type: 'button',
      position: [206, 16],
      sprite: 'SchmLArrow'
    },

    schemeBtn: {
      type: 'button',
      position: [29, 160],
      sprite: 'BGRNBUT'
    },

    schemeBtn2: {
      type: 'button',
      position: [29, 248],
      sprite: 'BGRNBUT'
    },

    combineBtn: {
      type: 'button',
      position: [76, 324],
      sprite: 'CombineButt'
    },

    combineIndicator: {
      type: 'image',
      position: [43, 338],
      sprite: 'CombineIndicator3'
    },

    schemeImage: {
      type: 'image',
      position: [240, 146],
      sprite: 'Schargedring'
    },

    schemeItem1: {
      type: 'image',
      position: [579, 181],
      sprite: 'SchemHaveItem'
    },

    schemeItemIco: {
      type: 'icon',
      position: [579, 181],
      sprite: 'SchemHaveItem'
    },

    schemeItem2: {
      type: 'image',
      position: [579, 277],
      sprite: 'SchemHaveItem'
    }
  }
}
