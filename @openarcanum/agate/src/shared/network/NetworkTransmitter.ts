import NetworkedEventFactory, {type NetworkEventOptions} from './NetworkedEventFactory'
import NetworkedEventCollection from './NetworkedEventCollection'
import Serializable, {type NetScheme, type SerializeResult} from '../serialize/Serializable'
import type Serializer from '../serialize/Serializer'
import Utils from '../misc/NetworkUtils'
export default class NetworkTransmitter {
  declare readonly serializer: Serializer
  readonly registeredEvents: Record<string, NetworkedEventFactory> = {}
  readonly networkedEventCollection = new NetworkedEventCollection()
  constructor(serializer: Serializer) {
    this.serializer = serializer
    serializer.registerClass(NetworkedEventCollection)
    for (const eventName of ['objectUpdate', 'objectCreate', 'objectDestroy']) this.registerNetworkedEventFactory(eventName, {
      netScheme: {stepCount: {type: 'int'}, objectInstance: {type: 'class'}}
    })
    this.registerNetworkedEventFactory('syncHeader', {netScheme: {stepCount: {type: 'int'}, fullUpdate: {type: 'uint8'}}})
  }
  registerNetworkedEventFactory(eventName: string, options: NetworkEventOptions): void {
    const classHash = Utils.hashStr(eventName)
    class WireEvent extends Serializable {
      static get netScheme(): NetScheme { return options.netScheme || {} }
    }
    // Prototype tags preserve the old deserialized event envelope; the class
    // supplies Serializable's actual methods rather than a forged constructor.
    Reflect.set(WireEvent.prototype, 'classId', classHash)
    Reflect.set(WireEvent.prototype, 'eventName', eventName)
    this.serializer.registerClass(WireEvent, classHash)
    this.registeredEvents[eventName] = new NetworkedEventFactory(this.serializer, eventName, options)
  }
  addNetworkedEvent(eventName: string, payload: Record<string, unknown>): Serializable | null {
    const factory = this.registeredEvents[eventName]
    if (!factory) { console.error(`NetworkTransmitter: no such event ${eventName}`); return null }
    const event = factory.create(payload)
    this.networkedEventCollection.events.push(event)
    return event
  }
  serializePayload(): SerializeResult | null {
    return this.networkedEventCollection.events.length ? this.networkedEventCollection.serialize(this.serializer) : null
  }
  deserializePayload(payload: unknown): Serializable {
    const buffer = payload && typeof payload === 'object' ? Reflect.get(payload, 'dataBuffer') : undefined
    if (!(buffer instanceof ArrayBuffer) && !(typeof SharedArrayBuffer !== 'undefined' && buffer instanceof SharedArrayBuffer)) {
      throw new Error('Network payload has no binary buffer')
    }
    return this.serializer.deserialize(buffer).obj
  }
  clearPayload(): void { this.networkedEventCollection.events = [] }
}
