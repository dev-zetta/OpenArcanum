// @flow

import Component from './Component'
import Location from '../../Location'
import WaypointList from '../WaypointList';

export default class Npc extends Component {
  aiData: Object
  expWorth: number
  expPool: number
  waypointCurrent: number
  standpointDay: Location
  standpointNight: Location
  origin: string
  faction: string
  priceMul: string
  reactionBase: number
  socialClass: string
  wait: any
  generatorData: string
  waypoints: WaypointList

  /**
   *
   */
  constructor() {
    super(...arguments)
    this.waypoints = new WaypointList()

    this.standpointDay = new Location()
    this.standpointNight = new Location()
  }

  init(params) {
    super.init(params)

    this.currentWaypoint = null
    //this.waypoints.clear
  }
}
