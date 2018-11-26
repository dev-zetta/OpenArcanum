/* global requireNode */

let ClientEngine = requireNode('lance-gg/es5/ClientEngine').default
let GameEngine = requireNode('lance-gg/es5/GameEngine').default
let GameWorld = requireNode('lance-gg/es5/GameWorld').default
let ServerEngine = requireNode('lance-gg/es5/ServerEngine').default
let Renderer = requireNode('lance-gg/es5/render/Renderer').default

let Lance = {
  GameEngine,
  GameWorld,
  ClientEngine,
  ServerEngine,
  Renderer
}

export default Lance
