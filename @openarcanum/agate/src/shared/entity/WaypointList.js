import Waypoint from './Waypoint'

export default class WaypointList {

  constructor() {
    this.waypoints = []
  }


  get count() {
    return this.waypoints.length
  }

  getAt(index) {
    return this.waypoints[index]
  }

  set(waypoints) {
    this.waypoints.clear()


    for (let waypoint of waypoints) {
      if (!(waypoint instanceof Waypoint)) {
        waypoint = new Waypoint(waypoint)
      }

      this.waypoints.push(waypoint)
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
