/* global AGate */

//https://github.com/lordnull/dice.js

let dicejs = AGate.requireNode('dice.js')

class Dice {
  constructor(syntax = '1d20') {
    this.syntax = syntax
  }

  roll(scope = undefined) {
    let result = dicejs.roll(this.syntax, scope)

    return result
  }
}

// Alternative: https://github.com/NickMele/node-dice
