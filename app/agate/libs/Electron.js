const { remote } = requireNode(`electron`)

export default class Electron {
  static createModal(options) {
    const browserWindowParams = {
      center: true,
      show: true,
      //frame: false,
      //transparent: true,
      resizable: false,
      minimizable: false,
      webPreferences: {
        nodeIntegration: false
      }
    };


    let win = new remote.BrowserWindow(
      Object.assign(options, {
        parent: remote.getCurrentWindow(),
        modal: true
      })
    )

    return win
  }
}
