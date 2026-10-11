import Route from '@ember/routing/route'

export default class IngameRoute extends Route {
  activate() {
    super.activate(...arguments)
    document.title = 'OpenArcanum'
  }
}
