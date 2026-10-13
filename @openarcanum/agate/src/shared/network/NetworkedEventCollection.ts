import Serializable, {type NetScheme} from '../serialize/Serializable'
export default class NetworkedEventCollection extends Serializable {
  declare events: Serializable[]
  static get netScheme(): NetScheme { return {events: {type: 'list', itemType: 'class'}} }
  constructor(events?: Serializable[] | null) { super(); this.events = events || [] }
}
