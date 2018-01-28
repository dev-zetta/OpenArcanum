import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('gui-slot-button', 'Integration | Component | gui slot button', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{gui-slot-button}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#gui-slot-button}}
      template block text
    {{/gui-slot-button}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
