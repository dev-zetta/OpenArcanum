import type ClientEngine from '../../ClientEngine'
export interface CommandEvaluation { action: string; data: unknown }
export default class Evaluator {
  declare gameEngine: ClientEngine
  constructor(options: { engine: ClientEngine }) { this.gameEngine = options.engine }
  onCommand(command: Record<string, unknown>): CommandEvaluation | void {}
  result(action: string, data: unknown): CommandEvaluation { return { action, data } }
}
