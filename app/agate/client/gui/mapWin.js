module.exports = {
  //parent: "middleWin",
  type: `window`,
  sprite: `MapMain`,
  position: `center`,
  visible: true,
  options: {
    toolbar: true,
    title: `Map`
  },

  components: {
    mapZoom: {
      type: `icon`,
      position: [25, 24],
      sprite: `SchmPCLens`
    },

    travelBtn: {
      type: `button`,
      position: [698, 312],
      sprite: `MapTravelBut`
    },

    zoomBtn: {
      type: `button`,
      position: [20, 165],
      sprite: `MapZoomBut`
    },

    wholeBtn: {
      type: `button`,
      position: [19, 267],
      sprite: `MapWholeBut`
    },

    navBtn: {
      type: `button`,
      position: [375, 347],
      sprite: `NavButton`
    },

    mapView: {
      type: `map-view`,
      position: [150, 11],
      size: [501, 365],
      style: { zIndex: -1 },
      //sprite: `worldmap`
    }
  }
}
