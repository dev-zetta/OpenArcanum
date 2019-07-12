export default class Action {
  constructor(description, callback) {
    this.description = description
    this._scores = []
    this._condition = () => true

    callback(this)
  }

  condition(callback) {
    if (!callback) {
      throw Error(`UtilityAi#Action#condition: Missing callback`)
    }

    this._condition = callback
  }

  score(description, callback) {
    if (!description) {
      throw Error(`UtilityAi#Action#score: Missing description`)
    }
    if (!callback) {
      throw Error(`UtilityAi#Action#score: Missing callback`)
    }

    this._scores.push({
      description,
      callback
    })
  }

  _validateScore(score) {
    if (!isNaN(score) && typeof score === `number`) {
      return score
    }
    return 0
  }

  log(...msg) {
    if (!this._print_debug) return
    console.log(...msg)
  }

  evaluate(data, debug = true) {
    this._print_debug = debug

    this.log(`Evaluate Action: `, this.description)
    if (!this._condition(data)) {
      this.log(`Condition not fulfilled`)
      return -Infinity
    }

    let totalScore = 0
    for (let score of this._scores) {
      const _score = this._validateScore(score.callback(data))
      this.log(`- `, score.description, _score)

      totalScore += _score
    }

    this.log(`Final Score: `, totalScore)
    return totalScore
  }
}
