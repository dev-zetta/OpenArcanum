export const ClientEngine = require(`lance-gg/es5/ClientEngine`).default
export const GameEngine = require(`lance-gg/es5/GameEngine`).default
export const GameWorld = require(`lance-gg/es5/GameWorld`).default
export const ServerEngine = require(`lance-gg/es5/ServerEngine`).default
export const Renderer = require(`lance-gg/es5/render/Renderer`).default
export const SimplePhysicsEngine = require(`lance-gg/es5/physics/SimplePhysicsEngine`)
  .default
export const KeyboardControls = require(`lance-gg/es5/controls/KeyboardControls`)
  .default
export const Serializer = require(`lance-gg/es5/serialize/Serializer`).default
export const Serializable = require(`lance-gg/es5/serialize/Serializable`)
  .default
export const DynamicObject = require(`lance-gg/es5/serialize/DynamicObject`)
  .default
export const GameComponent = require(`lance-gg/es5/serialize/GameComponent`)
  .default
export const BaseTypes = require(`lance-gg/es5/serialize/BaseTypes`).default

export default {
  GameEngine,
  GameWorld,
  ClientEngine,
  ServerEngine,
  DynamicObject,
  GameComponent,
  Renderer,
  Serializer,
  Serializable,
  BaseTypes,
  KeyboardControls,
  SimplePhysicsEngine
}
