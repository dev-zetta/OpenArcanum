module.exports = {
  type: `window`,
  position: `center`,
  visible: false,
  size: [400, 500],
  style: { background: `#333`},
  options: {
    toolbar: true,
    title: `Chat`
  },

  components: {
    helloChat: {
      type: `chat-window`,
      position: [0, 0],
      size: [`100%`, `100%`]
    }
  }
}
