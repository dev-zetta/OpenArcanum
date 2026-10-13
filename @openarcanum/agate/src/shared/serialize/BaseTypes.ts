/**
 * The BaseTypes class defines the base types used in Lance.
 * These are the types which can be used to define an object's netscheme attributes,
 * which can be serialized by lance.
 * @example
 *     static get netScheme() {
 *       return {
 *             strength: { type: 'float' },
 *             shield: { type: 'int8' },
 *             name: { type: 'string' },
 *             backpack: { type: 'class' },
 *             coins: {
 *                 type: 'list',
 *                 itemType: 'uint8'
 *             }
 *         };
 *     }
 */


/**
 * @type {object}
 * @property {string} FLOAT32 Seriablizable float
 * @property {string} INT32 Seriablizable 32-bit integer
 * @property {string} INT16 Seriablizable 16-bit integer
 * @property {string} INT8 Seriablizable 8-bit integer
 * @property {string} UINT8 Seriablizable unsigned 8-bit integer
 * @property {string} STRING Seriablizable string
 * @property {string} CLASSINSTANCE Seriablizable class. Make sure you register all the classes included in this way.
 * @property {string} LIST Seriablizable list.  In the netScheme definition, if an attribute is defined as a list, the itemType should also be defined.
 */
const TYPES = {
  /**
   * Seriablizable float
   * @alias TYPES.FLOAT32
   * @memberof! BaseTypes#
   */
  FLOAT32: `float`,

  /**
   * Seriablizable 32-bit int
   * @alias TYPES.INT32
   * @memberof! BaseTypes#
   */
  INT32: `int`,

  /**
   * Seriablizable 16-bit int
   * @alias TYPES.INT16
   * @memberof! BaseTypes#
   */
  INT16: `int16`,

  /**
   * Seriablizable 8-bit int
   * @alias TYPES.INT8
   * @memberof! BaseTypes#
   */
  INT8: `int8`,

  /**
   * Seriablizable unsigned 8-bit int
   * @alias TYPES.UINT8
   * @memberof! BaseTypes#
   */
  UINT8: `uint8`,

  /**
   * Seriablizable string
   * @alias TYPES.STRING
   * @memberof! BaseTypes#
   */
  STRING: `string`,

  /**
   * Seriablizable class.  Make sure you registered the classes included in this way.
   * @alias TYPES.CLASSINSTANCE
   * @memberof! BaseTypes#
   */
  CLASS: `class`,

  /**
   * Seriablizable list.
   * @alias TYPES.LIST
   * @memberof! BaseTypes#
   */
  LIST: `list`
}

export default TYPES
