import ECS from '../libs/ecs/ecs';
import {GfxTypes} from './assets';
import {Sprite} from '../client/Sprite';
import AGate from '../agate';

const Location = {
  name: 'location',
  defaults: {x: 0, y: 0},
};

export class Entity extends ECS.Entity {
  constructor(map) {
    super([Location]);
    this.map = map;

    /*let entity = new ECS.Entity();
    entity.updateComponent('pos', {
        x: canvas.width / 2,
        y: canvas.height / 2
    });
*/
  }

  async loadFromData(data) {
    this.updateComponents(data);

    if (this.map.engine.client) {
      let visualComponent = this.components['Visual'];
      if (visualComponent) {
        let visualClasses = visualComponent.classes;

        for (let className in visualClasses) {
          let visualClass = visualClasses[className];

          let sprite = new Sprite(this.map.engine.client);
          sprite.setData(this);

          await sprite.load(visualClass);
          visualClass.sprite = sprite;
        }
      }
    }
  }

  placeToScene(target) {
    let baseComponent = this.components['Base'];
    var position = baseComponent.location.tile;

    let visualComponent = this.components['Visual'];
    if (visualComponent) {
      let visualClass = visualComponent.classes['Current'];
      if (AGate.Utils.isUndefined(visualClass)) {
        visualClass = visualComponent.classes['Normal'];
      }

      if (AGate.Utils.isUndefined(visualClass)) {
        return;
      }

      let sprite = visualClass.sprite;

      if (AGate.Utils.isUndefined(sprite)) {
        return;
      }

      let offset = baseComponent.offset;

      let y = (position.x * 40);
      let x = (position.y * 40);

      //if (sprite.type == 'Portal')
      //console.log(sprite.currentStage)

      if (sprite.type === GfxTypes.Wall) {
        switch (sprite.currentStage) // Counter clockwise
        {
          case 'NorthEast':
            // South east, indoor (Up right)
            x -= 20; //(Sector.TileWidth / 2) - 1
            y -= 60; //(Sector.TileHeight / 2)
            break;
          case 'SouthEast':
            // South west, outdoor
            //x -= 20;
            y -= 40;
            break;
          case 'SouthWest':
            // South east, outdoor (Down left)
            x -= 20;
            y -= 20;
            break;

          case 'NorthWest':
            // South west, indoor (Up left)
            x -= 40; //(Sector.TileWidth / 2) + 1
            y -= 40; //(Sector.TileHeight / 2)
            break;
        }
      } else if (sprite.type === GfxTypes.Portal) {
        switch (sprite.side) // Counter clockwise
        {
          case 1:
            // South east, indoor (Up right)
            x -= 20; //(Sector.TileWidth / 2) - 1
            y -= 60; //(Sector.TileHeight / 2)
            break;
          case 3:
            // South west, outdoor
            //x -= 20;
            y -= 40;
            break;
          case 5:
            // South east, outdoor (Down left)
            x -= 20;
            y -= 20;
            break;

          case 7:
            // South west, indoor (Up left)
            x -= 60; //(Sector.TileWidth / 2) + 1
            y -= 20; //(Sector.TileHeight / 2)
            break;
        }
      } else {
        //offset.y += 10;
        offset.y -= 20;
      }

      sprite.addToScene(target, x, y, 0 /*position.y / 64 + position.x*/,
        offset);
      sprite.setData(this);

      sprite.setBlendMode();
    }
  }

}
