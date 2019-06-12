let Mixin = (superclass) =>
  class extends superclass {
    receiveEvent(name, method) {
      this.on(name, method.bind(this))
    }

    sendEvent(name, ...args) {
      this.emit(name, ...args)
    }
  }

export default Mixin
