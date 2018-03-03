/* global AGate */

// https://www.npmjs.com/package/utility-ai

const UtilityAi = AGate.requireNode('utility-ai');

export class Evaluator {
  constructor(system) {
    this.system = system;
    this.utilityAi = new UtilityAi();
  }

  addAction(name, options) {
    let config = this.system.actions.get(name);
    if (!config) {
      AGate.logError(`No AI action: ${name}`);
      return;
    }

    // Add actions to the AI
    this.utilityAi.addAction(name, action => {
      console.log(`Processing action: ${name}`);

      // Add scores to the action
      for (let key in config.scores) {
        action.score(key, config.scores[key]);
      }
    })
  }

  /**
   * Evaluates the AI with given data
   * @param data
   */
  process(data) {
    data = Object.assign({
      evaluator: this
    }, data)

    let result = this.utilityAi.evaluate(data);

    return result;
  }

}
