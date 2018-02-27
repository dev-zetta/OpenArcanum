import {ECS} from '../libs/ecs';
import {Entity} from './Entity';
import {Location} from './Location';
import AGate from '../agate';

import {Flags} from './Flags';
import Base from './entity/components/Base';
import Critter from './entity/components/Critter';
import Npc from './entity/components/Npc';
import Visual from './entity/components/Visual';


let Components = {
  Base,
  Critter,
  Npc,
  Visual
};

import {NpcSystem} from './entity/systems/NpcSystem';
import {RenderSystem} from './entity/systems/RenderSystem';
import {CombatSystem} from './entity/systems/CombatSystem';

let Systems = {
  NpcSystem,
  CombatSystem,
  RenderSystem,
};

const ClassTransformer = AGate.requireNode('class-transformer');

export class EntitySystem extends ECS {
  constructor(map) {
    super();

    this.map = map;

    for (let key in Systems) {
      let system = Systems[key];
      console.log(`Adding entity system: ${key}`);
      this.addSystem(new system(map.engine, this));
    }

    this.components = new Map();
    this.loadComponents();
  }

  loadComponents() {
    for (let key in Components) {
      this.components.set(key, Components[key]);
    }

    /*AGate.Utils.loadScripts('shared/entity/components', (name, script) => {
      let component = script.component;

      this.components.set(name, component)
    })*/
  }

  update() {
    super.update();
  }

  async newEntity(id, data) {

    //let baseComponent = components.base;
    //baseComponent.id = id;
    //baseComponent.location = new Location(baseComponent.location[0], baseComponent.location[1]);

    let components = {};
    for (let key in data) {
      let component = this.components.get(key);

      if (!component) {
        AGate.Utils.logError(`Unknown component: ${key}`);
        continue;
      }

      let instance = new component();
      Object.assign(instance, data[key]); // ClassTransformer.plainToClass(component, data[key]);
      instance.flags = new Flags(instance.flags);

      /*let location = instance.location;
      if (location) {
        location = [location[1], location[0]];
      }*/

      components[AGate.Utils.camelCase(key)] = instance;
    }

    let entity = new Entity(this.map, id);
    await entity.loadFromData(components);

    this.addEntity(entity);
    return entity;
  }

}
