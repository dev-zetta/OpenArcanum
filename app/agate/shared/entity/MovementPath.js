import {Waypoint} from './Waypoint';
import {Sector} from '../Sector';
import {Math} from '../Math';
import {Location} from '../Location';

export class MovementPath {
  constructor() {
    this.waypoints = [];
    this.currentIndex = 0;
    this.totalElapsed = 0;
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

    let visualClass = entity.visual.classes['Current'];
    let sprite = visualClass.sprite;

    if (!sprite || !sprite.isValid())
      return false;

    let speed = entity.base.movementSpeed || 1.0;

    this.waypointElapsed += elapsed;
    this.totalElapsed += elapsed;

    sprite.setStage(this.directionName);

    //console.log(x, y, octant, direction);

    // Update sprite frame
    sprite.update(this.totalElapsed, speed);

    // Update sprite position
    let delta = this.velocity.multiply((speed * Sector.TileWidthHalf) * (elapsed / 1000), true);
    sprite.move(delta.x, delta.y, elapsed);

    let timeAtTile = 1000 / speed;
    if (this.waypointElapsed >= timeAtTile) {
      let location = entity.base.location;
      let iso = sprite.isoPosition;
      location[0] = Math.round(iso.x / Sector.TileWidthHalf);
      location[1] = Math.round(iso.y / Sector.TileWidthHalf);

      this.waypointElapsed = this.waypointElapsed % timeAtTile;

      this.currentIndex++;
      this.start();
    }

    return true;
  }


}
