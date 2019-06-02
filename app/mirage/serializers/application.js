import { JSONAPISerializer } from 'ember-cli-mirage'
import DS from 'ember-data'

export default JSONAPISerializer.extend(DS.EmbeddedRecordsMixin, {
  embed: true,
  include: [`components`]
})
