export default class {
  constructor(options) {
    this.engine = options.engine
  }

  onCommand(command: Object) {

  }

  result(action, data) {
    return {action, data}
  }
}
