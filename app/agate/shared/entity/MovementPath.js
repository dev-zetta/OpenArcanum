import {Waypoint} from './Waypoint';
import {Sector} from '../Sector';
import {Math} from '../Math';
import {Location} from '../Location';

export class MovementPath {
  constructor() {
    this.waypoints = [];
    this.currentIndex = 0;
    //this.totalElapsed = 0;
    this.waypointElapsed = 0;
  }

  /**
   *
   */
  clear() {
    this.waypoints.length = 0;
    this.currentIndex = 0;
  }

  /**
   *
   * @param list
   */
  addPoints(list) {
    for (let i = 0; i < list.length; i++) {
      let waypoint = list[i];

      this.waypoints.push(
        waypoint
      );
    }
  }

  /**
   *
   * @returns {boolean}
   */
  start() {
    if (this.currentIndex + 1 >= this.waypoints.length) {
      return false;
    }

    let current = new Location(this.waypoints[this.currentIndex]);
    this.velocity = current.getVelocity(this.waypoints[this.currentIndex + 1]);

    let direction = Location.velocityToDirection(this.velocity);
    this.directionName = String(direction);
    this.movedDistance = 0;
    //let vec = current.lerp(next, percent, true);
  }

  /**
   *
   * @param entity
   * @param elapsed
   * @returns {boolean}
   */
  process(entity, elapsed) {
    if (this.currentIndex + 1 >= this.waypoints.length) {
      return false;
    }

    let speed = entity.npc.getMovementSpeed();

    //this.waypointElapsed += elapsed;
    //this.totalElapsed += elapsed;

    //console.log(x, y, octant, direction);

    // Update sprite frame
    //sprite.update(this.totalElapsed, speed);

    // Update sprite position
    let delta = this.velocity.multiply((speed * Sector.TileWidthHalf) * (elapsed / 1000), true);
    entity.moved = entity.base.move(delta.x, delta.y);

    //let timeAtTile = 1000 / speed;
    if (entity.moved /*this.waypointElapsed >= timeAtTile*/) {
      //this.waypointElapsed = this.waypointElapsed % timeAtTile;
      this.movedDistance++;
      this.currentIndex++;
      this.start();
    }

    this.processVisual(entity, delta.x, delta.y);
    return true;
  }


  processVisual(entity, dx, dy) {
    let visualClass = entity.getCurrentVisual();
    if (!visualClass)
      return false;

    let sprite = visualClass.sprite;
    if (!sprite || !sprite.isValid())
      return false;

    sprite.setStage(this.directionName);
    sprite.move(dx, dy);
    return true;
  }


}
