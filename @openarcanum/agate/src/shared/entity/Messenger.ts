import Event, { type EventCallback } from './Event'

export default class Messenger {
  _events: Record<string, Event[]> = {}
  fired = 0
  handled = 0
  listenTo(name: string, callback: EventCallback): Event {
    const event = new Event(name, callback)
    ;(this._events[name] ||= []).push(event)
    return event
  }
  trigger(name: string, entity?: unknown, option?: unknown): void {
    this.fired++
    for (const event of this._events[name] || []) if (event.fire(name, entity, option)) this.handled++
  }
  resetCounters(): void { this.fired = this.handled = 0 }
}
