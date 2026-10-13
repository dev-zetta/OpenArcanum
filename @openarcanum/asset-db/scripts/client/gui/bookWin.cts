import type { WidgetDefinition, WidgetInstance, TabbedWidget, BookWidget, DisciplineWidget, CollegeWidget, SchemaWidget, Discipline } from '../../WidgetTypes.cjs'
const definition = {
  type: `window`,
  visible: false,
  position: `center`,
  //size: [800, 600],
  sprite: `BookMain`,
  options: {
    toolbar: true,
    title: `Logbook`,
    icon: 'MMSkull'
  },

  components: {},

  events: {
    created(this: BookWidget) {
      let tabs = [
        {
          name: `Note`,
          button: `TabNote`
        },
        {
          name: `Quest`,
          button: `TabQuest`
        },
        {
          name: `Rep`,
          button: `TabRep`
        },
        {
          name: `BlessCurse`,
          button: `TabBlessCurse`
        },
        {
          name: `EgoInjure`,
          button: `TabEgoInjure`
        },
        {
          name: `BackGrnd`,
          button: `TabBackGrnd`
        },
        {
          name: `Keys`,
          button: `TabKeys`
        }
      ]

      let self = this

      this.currentTab = tabs[0]

      this.switchTo = (index: number) => {
        this.currentTab = tabs[index]

        /*for (let i = 1; i <= 7; i++) {
          let tabBtn = this.getChild(`bookTabBtn${i}`);

          tabBtn.setSprite(`${tabs[index].button}`);
        }*/
      }

      this.onTabClick = (index: number) => {}

      let x = 531
      let y = 43

      for (let i = 0; i < tabs.length; i++) {
        let tab = tabs[i]

        let model = this.createChild({
          id: `${tab.name}Switch`,
          type: `button`,
          position: [x, y],
          sprite: `${tab.button}`,
          options: {
            tooltip: tab.name
          },
          events: {
            click(this: WidgetInstance) {
              self.switchTo(i)
            }
          }
        })

        y += 45
      }
    }
  }
} satisfies WidgetDefinition

export = definition
