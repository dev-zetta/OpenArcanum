import AGate from '../agate';
import {ECS} from '../libs/ecs';
import {GfxTypes} from './assets';
import {Sprite} from '../client/Sprite';
import {Utils} from '../client/Utils';
import {Light} from '../client/Light';
import {Location} from './Location';
import {Sector} from './Sector';

let Components = {

};


export class Entity extends ECS.Entity {
  constructor(map) {
    super([]);
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
    let location = new Location(baseComponent.location);

    let visualComponent = this.components['Visual'];
    if (visualComponent && visualComponent.classes) {
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
      if (AGate.Utils.isArray(offset)) {
        offset = {x: offset[0], y: offset[1]};
      }

      let y = (location.x * Sector.TileWidthHalf);
      let x = (location.y * Sector.TileWidthHalf);

      if (sprite.type === GfxTypes.Wall) {
        switch (sprite.currentStage) // Counter clockwise
        {
          case 'NorthEast':
            // South east, indoor (Up right)
            //x += 20; //(Sector.TileWidth / 2) - 1
            y -= Sector.TileWidthHalf; //(Sector.TileHeight / 2)
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
            x -= Sector.TileWidthHalf; //(Sector.TileWidth / 2) + 1
            //y -= 20; //(Sector.TileHeight / 2)
            break;
        }
      } else if (sprite.type === GfxTypes.Portal) {
        switch (sprite.side) // Counter clockwise
        {
          case 1:
            // South east, indoor (Up right)
            //x += 40; //(Sector.TileWidth / 2) - 1
            y -= Sector.TileWidthHalf; //(Sector.TileHeight / 2)
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
            x -= Sector.TileWidthHalf; //(Sector.TileWidth / 2) + 1
            //y -= 20; //(Sector.TileHeight / 2)
            break;
        }
      } else {

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
                sprite.setBlendMode('BlendAdd');
                break;
              case 'BlendMul':
                sprite.setBlendMode('BlendMul');
                break;
            }
          }
        }

      }

      let lightComponent = visualComponent.light;
      if (lightComponent) {
        if (lightComponent.color) {
          let color = Utils.stringToColor(lightComponent.color);
          //sprite.setTint(color);

          this.light = new Light();
          this.light.addToScene(target.scene, sprite.sprite.x, sprite.sprite.y, color);
        }
      }

    }
  }

}
