interface SocketEmitter {
  on<Args extends unknown[]>(name: string, callback: (...args: Args) => unknown): unknown
  emit(name: string, ...args: unknown[]): unknown
}
interface SocketMethods {
  receiveEvent<Args extends unknown[]>(name: string, method: (...args: Args) => unknown): void
  sendEvent(name: string, ...args: unknown[]): void
}
type Constructor = new(...args: never[]) => SocketEmitter
export default function SocketEvents<C extends Constructor>(superclass: C) {
  // The returned constructor retains C's exact public argument tuple. Inside
  // the forwarding implementation the tuple crosses as unknown values.
  const Base = superclass as unknown as new(...args: unknown[]) => SocketEmitter
  class SocketEventsMixin extends Base implements SocketMethods {
    receiveEvent<Args extends unknown[]>(name: string, method: (...args: Args) => unknown): void { this.on(name, method.bind(this)) }
    sendEvent(name: string, ...args: unknown[]): void { this.emit(name, ...args) }
  }
  return SocketEventsMixin as unknown as C & { new(...args: ConstructorParameters<C>): InstanceType<C> & SocketMethods }
}
