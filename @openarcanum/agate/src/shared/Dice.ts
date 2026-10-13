/* global AGate */

//https://github.com/lordnull/dice.js

const dicejs = require('dice.js') as { roll(syntax: string, scope?: Record<string, number>): unknown }

class Dice {
  declare syntax: string

  constructor(syntax = `1d20`) {
    this.syntax = syntax
  }

  roll(scope?: Record<string, number>): unknown {
    let result = dicejs.roll(this.syntax, scope)

    return result
  }
}

// Alternative: https://github.com/NickMele/node-dice
