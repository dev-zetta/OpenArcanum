import Component from './Component'
import Location from '../../Location'
import WaypointList from '../WaypointList'
import Waypoint from '../Waypoint'

export default class Npc extends Component {
  declare aiData: Record<string, unknown>
  declare expWorth: number
  declare expPool: number
  declare waypointCurrent: number
  declare standpointDay: Location
  declare standpointNight: Location
  declare origin: string
  declare faction: string
  declare priceMul: string
  declare reactionBase: number
  declare socialClass: string
  declare wait: unknown
  declare generatorData: string
  declare waypoints: WaypointList
  declare currentWaypoint: number | null | undefined


  /**
   *
   */
  constructor() {
    super()
    this.waypoints = new WaypointList()

    this.standpointDay = new Location()
    this.standpointNight = new Location()
  }

  init(params: { entity: import("../Entity").default }) {
    super.init(params)

    this.currentWaypoint = null
    //this.waypoints.clear
  }
}
