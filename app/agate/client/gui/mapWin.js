module.exports = {
  //parent: "middleWin",
  type: 'window',
  sprite: 'MapMain',
  align: 'center-center',
  visible: false,
  style: { borderRadius: '16px' },

  components: {
    mapZoom: {
      type: 'icon',
      position: [25, 24],
      sprite: 'CharPCC'
    },

    travelBtn: {
      type: 'button',
      position: [698, 312],
      sprite: 'MapTravelBut'
    },

    zoomBtn: {
      type: 'button',
      position: [20, 165],
      sprite: 'MapZoomBut'
    },

    wholeBtn: {
      type: 'button',
      position: [19, 267],
      sprite: 'MapWholeBut'
    },

    navBtn: {
      type: 'button',
      position: [375, 347],
      sprite: 'NavButton'
    },

    mapView: {
      type: 'widget',
      position: [150, 11],
      size: [501, 365],
      style: { background: 'rgba(255, 255, 255, 0.7)', zIndex: 0 }
    }
  }
}
