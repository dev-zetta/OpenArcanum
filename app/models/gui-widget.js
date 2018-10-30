import DS from 'ember-data'
import { computed } from '@ember/object'
/*
import {
  fragment
  //fragmentArray,
  //array
} from 'ember-data-model-fragments/attributes';*/

const { Model, attr, hasMany, belongsTo } = DS

// https://andycrum.github.io/ember-data-model-maker/

export default Model.extend({
  type: attr('string'),
  componentName: computed('type', function() {
    let type = this.get('type')
    return `gui-${type ? type : 'widget'}`
  }),

  sprite: attr('string'),
  position: attr(),
  size: attr(),
  style: attr(),
  prototype: attr(), // class/es
  align: attr(),
  visible: attr(),
  animation: attr(),
  events: attr(),
  listeners: attr(),

  options: attr(),

  parent: belongsTo('gui-widget', { inverse: 'components' }),
  components: hasMany('gui-widget', { inverse: 'parent' })
})
