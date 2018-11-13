module.exports = {
  type: `window`,
  position: `left-center`,
  visible: true,
  size: [400, 400],
  style: { background: `#333`},
  options: {
    toolbar: true,
    title: `Debug`
  },

  components: {
    recordPanel: {
      type: `screen-record`,
      position: [30, 30],
      size: [400, 400]
    },

    reloadBtn: {
      visible: false,
      type: `button`,
      position: [100, 20],
      prototype: `btn btn-success`,
      events: {
        click(event) {
          this.emitEvent(`gameReload`)
        }
      }
    }
  }
}
