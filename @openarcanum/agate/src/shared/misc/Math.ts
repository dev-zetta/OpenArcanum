// const stdlib = require('@stdlib/stdlib')

// Import Math namespace
// https://stdlib.io/develop/docs/api/@stdlib/math/base/special/
//let Math = stdlib.math.base.special
//Math.PI = stdlib.math.constants[`PI`]

//Math.random = stdlib.math.base.random.randu;


const xorshift = require('xorshift') as { random(): number }

Math.random = () => xorshift.random()

Math.randomFloat = (min: number, max: number) => Math.random() * (max - min) + min

Math.randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

export default Math
