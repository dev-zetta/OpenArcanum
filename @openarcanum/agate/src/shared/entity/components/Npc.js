// @flow

import Component from './Component'
import Flags from '../../Flags'
import Location from '../../Location'

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
  waypoints: Array<Location>

  flags: Flags

  /**
   *
   */
  constructor() {
    super(...arguments)
    this.flags = new Flags()
    this.waypoints = []

    this.standpointDay = new Location()
    this.standpointNight = new Location()
  }

  init(params) {
    super.init(params)

    this.currentWaypoint = null
    this.waypoints.length = 0
  }
}
