module.exports = {
  type: 'window',
  visible: false,
  align: 'center-center',
  //size: [800, 600],
  sprite: 'BookMain',
  components: {},

  events: {
    created() {
      let tabs = [
        {
          name: 'Note',
          button: 'TabNote'
        },
        {
          name: 'Quest',
          button: 'TabQuest'
        },
        {
          name: 'Rep',
          button: 'TabRep'
        },
        {
          name: 'BlessCurse',
          button: 'TabBlessCurse'
        },
        {
          name: 'EgoInjure',
          button: 'TabEgoInjure'
        },
        {
          name: 'BackGrnd',
          button: 'TabBackGrnd'
        },
        {
          name: 'Keys',
          button: 'TabKeys'
        }
      ]

      let self = this

      this.currentTab = tabs[0]

      this.switchTo = index => {
        this.currentTab = tabs[index]

        /*for (let i = 1; i <= 7; i++) {
          let tabBtn = this.getChild(`bookTabBtn${i}`);

          tabBtn.setSprite(`${tabs[index].button}`);
        }*/
      }

      this.onTabClick = index => {}

      let x = 531
      let y = 43

      for (let i = 0; i < tabs.length; i++) {
        let tab = tabs[i]

        let model = this.createChild({
          id: `${tab.name}Switch`,
          type: 'button',
          position: [x, y],
          sprite: `${tab.button}`,
          events: {
            click() {
              self.switchTo(i)
            }
          }
        })

        y += 45
      }
    }
  }
}
