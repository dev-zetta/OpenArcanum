/* global requireNode */
import Phaser from '../phaser'

import MenuComponent from '../Components/MenuComponent'

class Menu extends Phaser.State {

  constructor() {
    super();
    this.components = [new MenuComponent(['Attack', 'Magic', 'OTHER COOL STUFF'])]
  }

  preload() {
    this.components.forEach( (item) => {
      item.preload(this)
    })
  }

  create() {
    this.components.forEach( (item) => {
      item.create(this)
    })
    this.enterKey = this.game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
    this.enterKey.onDown.add(() => {
      let newMenu = new MenuComponent(['One choice', 'Two choice'], 900, 200)
      this.components.push(newMenu.create(this))
    })

  }

  update() {
    this.components.forEach( (item) => {
      item.update(this)
    })

    this.game.debug.text('Elapsed seconds: ' + this.game.time.totalElapsedSeconds().toFixed(3), 32, 32);

  }

}

export default Menu;
