export default class {
  constructor(options) {
    this.gameEngine = options.engine

  }

  onCommand(command: Object) {

  }

  result(action, data) {
    return {action, data}
  }
}
