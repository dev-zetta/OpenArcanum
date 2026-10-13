import RealmModel from '../RealmModel'

class Model extends RealmModel {
  /**
   *
   * @param schemaName
   */
  constructor(realm: ConstructorParameters<typeof RealmModel>[0], schema: ConstructorParameters<typeof RealmModel>[1]) {
    super(realm, schema)
  }
}

export default Model
