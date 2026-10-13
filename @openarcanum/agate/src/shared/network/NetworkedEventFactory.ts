import Serializable, {type NetScheme} from '../serialize/Serializable'
import type Serializer from '../serialize/Serializer'
import Utils from '../misc/NetworkUtils'
export interface NetworkEventOptions {netScheme?: NetScheme}
export default class NetworkedEventFactory {
  declare seriazlier: Serializer // Historical public spelling retained.
  declare options: NetworkEventOptions
  declare eventName: string
  declare netScheme: NetScheme | undefined
  constructor(serializer: Serializer, eventName: string, options: NetworkEventOptions = {}) {
    this.seriazlier = serializer
    this.options = {...options}
    this.eventName = eventName
    this.netScheme = options.netScheme
  }
  create(payload: Record<string, unknown>): Serializable {
    const event = new Serializable()
    event.classId = Utils.hashStr(this.eventName)
    if (this.netScheme) {
      event.netScheme = {...this.netScheme}
      for (const property of Object.keys(this.netScheme)) Reflect.set(event, property, payload[property])
    }
    return event
  }
}
