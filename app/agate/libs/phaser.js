/* global requireNode */
/*
window.PIXI = requireNode('phaser-ce/build/custom/pixi')
window.p2 = requireNode('phaser-ce/build/custom/p2')
window.Phaser = requireNode('phaser-ce/build/custom/phaser-split')
*/

window.WEBGL_RENDERER = true
window.CANVAS_RENDERER = true

var Phaser = requireNode('phaser')

export default Phaser
