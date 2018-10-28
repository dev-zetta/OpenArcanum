/* global requireNode */

import { stdlib } from '../../libs/stdlib'

// Import Math namespace
var Math = stdlib.math.base.special
Math.PI = stdlib.math.constants['PI']

//Math.random = stdlib.math.base.random.randu;

// Import Vec2
// https://www.npmjs.com/package/vec2
const Vec2 = requireNode('vec2')
Math.Vec2 = Vec2

const xorshift = requireNode('xorshift')

Math.random = () => xorshift.random()

export { Math }
