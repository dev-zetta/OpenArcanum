import Waypoint from './Waypoint'

export default class WaypointList {
  declare waypoints: Waypoint[]

  constructor() {
    this.waypoints = []
  }

  get count() {
    return this.waypoints.length
  }

  getAt(index: number) {
    return this.waypoints[index]
  }

  set(waypoints: (Waypoint | number[] | { x: number; y: number })[]) {
    this.waypoints.length = 0

    for (let waypoint of waypoints) {
      if (!(waypoint instanceof Waypoint)) {
        waypoint = new Waypoint(waypoint)
      }

      this.waypoints.push(waypoint as Waypoint)
    }
  }

  toPlainObject() {
    let result = []
    for (let waypoint of this.waypoints) {
      result.push(waypoint.toPlainObject())
    }

    return result
  }
}
