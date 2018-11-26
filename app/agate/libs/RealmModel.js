import Realm from './Realm'

class RealmModel {

  constructor(realm, schema, /*dbPath = null*/) {
    /*if (dbPath === null) {
      this.dbPath = Realm.defaultPath
    } else {
      this.dbPath = dbPath
    }*/

    this.schema = schema
    this.realm = realm //this.makeRealm(this.dbPath, this.schema)


    let linkedProperties = {}
    for (let property in this.schema.properties) {
      let typeName = this.schema.properties[property]
      if (AGate.Utils.isFirstUpperCase(typeName)) {
        linkedProperties[property] = typeName.replace('[]', '')
      }
    }

    this.linkedProperties = linkedProperties
  }

  makeRealm(dbPath, schema) {
    console.error(schema)
    this.realm = new Realm({
      path: dbPath,
      schema: [schema]
    })
  }

  /**
   *
   * @param func
   * @returns {Promise}
   */
  async write(func) {
    return new Promise((resolve, reject) => {
      this.realm.write(() => {
        resolve(func())
      })
    })
  }

  /**
   * Link indexes to object instances
   * @param object
   */
  linkProperties(object) {
    for (let property in this.linkedProperties) {
      let value = object[property]
      if (AGate.Utils.isObjectLike(value)) {
        continue
      }

      let typeName = this.linkedProperties[property]

      let other = this.realm.objectForPrimaryKey(typeName, value)

      //console.error(property, other)
      object[property] = other
    }

    return object
  }

  /**
   *
   * @param input
   * @param updateFlag
   * @returns {Promise<*>}
   */
  async create(input, updateFlag = false) {
    return this.write(() => {
      //console.error(this.schema)
      if (Array.isArray(input)) {
        let result = []
        for (let entry of input) {
          result.push(this.realm.create(this.schema.name, this.linkProperties(entry), updateFlag))
        }
        return result
      } else {
        let result = this.realm.create(this.schema.name, this.linkProperties(input), updateFlag)
        return result
      }
    })
  }

  /**
   *
   * @param input
   * @returns {Promise<*>}
   */
  async save(input) {
    return this.create(input, true)
  }

  /**
   *
   * @param input
   * @param filterString
   * @returns {Promise<*>}
   */
  async update(input, filterString) {
    let data = this.filtered(filterString)

    await this.write(() => {
      for (let entry of data) {
        for (let property in this.schema.properties) {
          if (Object.keys(input).includes(property)) {
            entry[property] = input[property]
          }
        }
      }
    })

    return data
  }

  /**
   *
   * @param object
   */
  delete(object) {
    this.write(() => {
      this.realm.delete(object)
    })
  }

  /**
   *
   * @param pk
   * @returns {*}
   */
  get(pk = null) {
    if (pk === null) {
      return this.realm.objects(this.schema.name)
    } else {
      let data = this.filtered(`${this.schema.primaryKey} == '${pk}'`)
      if (data.length > 0) {
        return data[0]
      } else {
        return {}
      }
    }
  }

  /**
   *
   * @param filterString
   * @returns {*}
   */
  filtered(filterString) {
    return this.get().filtered(filterString)
  }
}

export {Realm, RealmModel}
