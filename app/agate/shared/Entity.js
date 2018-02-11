import ECS from '../libs/ecs/ecs';
import {GfxTypes} from './assets';
import {Sprite} from '../client/Sprite';
import {Utils} from '../client/Utils';
import AGate from '../agate';
import {Light} from '../client/Light';

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
            offset.x += 40; //(Sector.TileWidth / 2) - 1
            offset.y -= 20; //(Sector.TileHeight / 2)
            break;
          case 'SouthEast':
            // South west, outdoor
            //x -= 20;
            //offset.y -= 40;
            break;
          case 'SouthWest':
            // South east, outdoor (Down left)
            //offset.x -= 20;
            //offset.y -= 20;
            break;

          case 'NorthWest':
            // South west, indoor (Up left)
            offset.x -= 40; //(Sector.TileWidth / 2) + 1
            offset.y -= 20; //(Sector.TileHeight / 2)
            break;
        }
      } else if (sprite.type === GfxTypes.Portal) {
        switch (sprite.side) // Counter clockwise
        {
          case 1:
            // South east, indoor (Up right)
            offset.x += 40; //(Sector.TileWidth / 2) - 1
            offset.y -= 20; //(Sector.TileHeight / 2)
            break;
          case 3:
            // South west, outdoor
            //x -= 20;
            //y -= 40;
            break;
          case 5:
            // South east, outdoor (Down left)
            //x -= 20;
            //y -= 20;
            break;

          case 7:
            // South west, indoor (Up left)
            offset.x -= 40; //(Sector.TileWidth / 2) + 1
            offset.y -= 20; //(Sector.TileHeight / 2)
            break;
        }
      } else {
        //offset.x += 20;
        //offset.x -= 20;
      }

      sprite.addToScene(target, x, y, 0 /*position.y / 64 + position.x*/,
        offset);
      sprite.setData(this);


      // Process render components
      let renderComponent = visualComponent.render;
      if (renderComponent) {

        // Process render flags
        if (renderComponent.flags) {
          let flags = renderComponent.flags;

          for (let i = 0; i < flags.length; i++) {
            switch (flags[i]) {
              case 'BlendAdd':
                sprite.setBlendMode();
                break;
            }
          }
        }

      }

      let lightComponent = visualComponent.light;
      if (lightComponent) {

        if (lightComponent.color) {
          let color = Utils.stringToColor(lightComponent.color);
          //console.log(color)
          sprite.setTint(color);
        }

       // console.log(sprite.sprite.x, sprite.sprite.y)

        //this.light = new Light();
        //this.light.addToScene(target.scene, sprite.sprite.x, sprite.sprite.y);
      }


      //sprite.setTint(0x808080);
    }
  }

}
