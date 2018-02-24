import {System} from '../System';
import Enums from '../../enums'
import AGate from '../../../agate';

export class NpcSystem extends System {

  test(entity) {
    return !!entity.npc;
  }

  update(entity, elapsed) {
    let {base, npc} = entity;

    if (base.flags.has(Enums.State.Moving)) {
      let moved = npc.movementPath.process(entity, elapsed);

      if (!moved) {
        base.flags.remove([Enums.State.Moving, Enums.State.MovingToWaypoint]);
        npc.movementPath.clear();
        /*if (base.flags.has(Enums.State.MovingToWaypoint)) {

        }*/
      }
    }

    let evaluator = this.map.aiSystem.getEvaluator('npc');

    let result = evaluator.process({
      entity,
      Enums
    });

    if (result.score < 0)
      return;

    console.log(result);
    let actionName = AGate.Utils.camelCase(result.action);
    this[actionName].call(this, entity);
  }

  enter(entity) {

  }

  exit(entity) {

  }

  moveToWaypoint(entity) {
    let {base, npc} = entity;

    //if (npc.currentWaypoint == 0)
    //  return;

    base.flags.add(Enums.State.PlanningToMove);

    if (npc.currentWaypoint == null) {
      npc.currentWaypoint = 1;
    } else {
      npc.currentWaypoint++;
      if (npc.currentWaypoint == npc.waypoints.length)
        npc.currentWaypoint = 0;
    }

    //console.log(npc.currentWaypoint);

    let waypoint = npc.waypoints[npc.currentWaypoint];

    //console.log(base.location, waypoint)
    this.map.pathFind.findPath(base.location, waypoint).then((path) => {

      npc.movementPath.addPoints(path);
      npc.movementPath.start();

      this.engine.client.scene.highlightTiles(path);

      //console.log(path);

      base.flags.remove(Enums.State.PlanningToMove);
      base.flags.add([Enums.State.Moving, Enums.State.MovingToWaypoint]);
    });

  }
}
