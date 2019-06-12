import Component from './Component'
import Flags from '../../Flags'
import type {LocationRaw} from '../Types'

export default class Npc extends Component {
  aiData: Object
  expWorth: number
  expPool: number
  waypointCurrent: number
  standpointDay: LocationRaw
  standpointNight: LocationRaw
  origin: string
  faction: string
  priceMul: string
  reactionBase: number
  socialClass: string
  wait: any
  generatorData: string
  waypoints: Array<LocationRaw>

  flags: Flags

  /**
   *
   */
  constructor() {
    super(...arguments)
    this.waypoints = []
    this.currentWaypoint = null


    this.flags = null
  }


}
