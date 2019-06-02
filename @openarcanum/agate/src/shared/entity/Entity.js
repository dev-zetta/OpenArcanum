// @flow
import ECS from '../../libs/ECS'
import Sprite from '../../client/Sprite'
/*import Utils from '../../client/Utils'
import Light from '../../client/Light'
import Location from '../Location'
import Sector from '../map/Sector'*/
import Enums from '../enums'
import type GameEngine from '../GameEngine';

//const { GfxTypes } = Enums

export default class Entity extends ECS.Entity {
  moved: boolean


  /**
   *
   * @param engine
   * @param options
   */
  constructor(engine: GameEngine, options: Object) {
    super(options)
    this.engine = engine
  }

  /**
   *
   */
  dispose() {
    super.dispose()
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadData() {
    //this.updateComponents(data)

    if (this.engine.client) {
      let visualComponent = this.visual
      if (visualComponent) {
        let visualClasses = visualComponent.classes

        for (let className: string in visualClasses) {
          let visualClass = visualClasses[className]

          let sprite = new Sprite(this.engine.client)
          sprite.setData(this)

          await sprite.load(visualClass)
          visualClass.sprite = sprite
        }
      }
    }
  }

  /**
   *
   * @param x
   * @param y
   */
  move(x: number, y: number) {}
}
