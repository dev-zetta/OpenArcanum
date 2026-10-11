import Model, { attr, hasMany, belongsTo } from '@ember-data/model'
import { computed } from '@ember/object'



// https://andycrum.github.io/ember-data-model-maker/

export default Model.extend({
  type: attr(`string`),
  componentName: computed(`type`, function() {
    let type = this.get(`type`)
    return `gui-${type ? type : `widget`}`
  }),

  sprite: attr(`string`),
  position: attr(),
  size: attr(),
  style: attr(),
  prototype: attr(), // class/es
  visible: attr(),
  value: attr(),
  animation: attr(),
  events: attr(),
  listeners: attr(),
  methods: attr(),

  options: attr(),

  parent: belongsTo(`gui-widget`, { async: false, inverse: `components` }),
  components: hasMany(`gui-widget`, { async: false, inverse: `parent` })
})
