// @flow
import Component from './Component'

// Converted walls retain their flags and other source fields through the same
// prototype/component loader as scenery. Collision uses Base.type and flags.
export default class Wall extends Component {}
