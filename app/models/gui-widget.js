import DS from 'ember-data';
import { computed } from '@ember/object';

// https://andycrum.github.io/ember-data-model-maker/

export default DS.Model.extend({
  type: DS.attr('string'),
  componentName: DS.attr('string'),
  sprite: DS.attr('string'),
  position: DS.attr(),
  size: DS.attr(),
  align: DS.attr(),
  parent: DS.belongsTo('gui-widget', { inverse: 'components' }),
  components: DS.hasMany('gui-widget', { inverse: 'parent' })
});
