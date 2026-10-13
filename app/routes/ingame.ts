import Route from '@ember/routing/route'
import type Transition from '@ember/routing/transition'

export default class IngameRoute extends Route {
  activate(transition: Transition) {
    super.activate(transition)
    document.title = 'OpenArcanum'
  }
}
