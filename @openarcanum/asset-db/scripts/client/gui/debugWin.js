module.exports = {
  type: `window`,
  position: `left-center`,
  visible: false,
  size: [400, 400],
  style: { background: `#333`},
  options: {
    toolbar: true,
    title: `Debug`
  },

  components: {
    recordPanel: {
      type: `screen-record`,
      position: [20, 20],
      size: [400, 400]
    },

    startBtn: {
      visible: true,
      type: `button`,
      position: [80, 200],
      prototype: ``,
      options: {
        label: `Start`
      },
      events: {
        click(event) {
          this.emitEvent(`game.reload`)
        }
      }
    },

    playBtn: {
      visible: true,
      type: `button`,
      position: [20, 200],
      prototype: ``,
      options: {
        label: `Play`
      },
      events: {
        click(event) {
          this.emitEvent(`showPlayer`)
        }
      }
    },

    startGameBtn: {
      visible: true,
      type: `button`,
      position: [20, 240],
      prototype: ``,
      options: {
        label: `Start Game`
      },
      events: {
        click(event) {

        }
      }
    }
  }
}
