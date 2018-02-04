import {stdlib} from '../libs/stdlib';

var Math = stdlib.math.base.special;
Math.PI = stdlib.math.constants['PI'];

Math.random = stdlib.math.base.random.randu;

export {Math};
