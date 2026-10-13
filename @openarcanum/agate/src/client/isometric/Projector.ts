interface DepthSprite {
  _isoPosition: Point3Like; isoBounds: import('./GeometryTypes').Bounds3Like
  isoSpritesBehind?: (DepthSprite | null)[]; isoVisitedFlag?: boolean
  depth: number; displayOriginY: number; postUpdate(): void
}
import type { Point2Like, Point3Like } from './GeometryTypes'
import type Camera from './Camera'

import Point3 from './Point3'
import Math from './Math'
import Point2 from './Point2'

/**
 * @class Projector
 *
 * @classdesc
 * Creates a new Isometric Projector object, which has helpers for projecting x, y and z coordinates into axonometric x and y equivalents.
 *
 * @constructor
 * @param {Phaser.Game} game - The current game object.
 * @param {number} projectionAngle - The angle of the axonometric projection in radians. Defaults to approx. 0.4636476 (Math.atan(0.5) which is suitable for 2:1 pixel art dimetric)
 * @return {Cube} This Cube object.
 */

export default class Projector {
  declare camera: Camera
  declare _transform: Array<number>
  declare _projectionAngle: number
  declare anchor: Point2

  //  Projection angles
  static get CLASSIC(): number {
    return Math.atan(0.5)
  }
  static get ISOMETRIC(): number {
    return Math.PI / 6
  }
  static get MILITARY(): number {
    return Math.PI / 4
  }

  /**
   * @property {Phaser.Game} game - The current game object.
   */

  /**
   * @property {array} _transform - The pre-calculated axonometric transformation values.
   * @private
   */

  /**
   * @property {number} _projectionAngle - The cached angle of projection in radians.
   * @private
   */

  /**
   * @property {number} projectionAngle - The angle of projection in radians.
   * @default
   */

  /**
   * @property {Point2} anchor - The x and y offset multipliers as a ratio of the game world size.
   * @default
   */

  constructor(camera: Camera, projectionAngle: number) {
    this.camera = camera
    this._transform = [1, 0.5]
    this._projectionAngle = 0
    this.projectionAngle = Projector.CLASSIC //Math.PI / 7 //26.565;  //
    this.anchor = new Point2(0.0, 0.0)
  }

  /**
   * @name Projector#projectionAngle
   * @property {number} projectionAngle - The angle of axonometric projection.
   */
  get projectionAngle(): number {
    return this._projectionAngle
  }

  set projectionAngle(angle: number) {
    if (angle === this._projectionAngle) {
      return
    }

    this._projectionAngle = angle
    this._transform = [
      Math.cos(this._projectionAngle),
      Math.sin(this._projectionAngle)
    ]

    //console.log(this._projectionAngle,  this._transform)

    //this._transform = [Math.cos(this._projectionAngle * Math.PI / 180), Math.sin(this._projectionAngle * Math.PI / 180)];

    //this._transform = [0.975, 0.5]
    this._transform = [1, 0.5]
  }

  /**
   * Use axonometric projection to transform a 3D Point3 coordinate to a 2D Point coordinate. If given the coordinates will be set into the object, otherwise a brand new Point object will be created and returned.
   * @method Projector#project
   * @param {Point3} point - The Point3 to project from.
   * @param {Point2} offset
   * @param {Point2} out - The Point to project to.
   * @return {Point2} The transformed Point.
   */
  project(point: Point3Like, offset?: Point2Like, out: Point2 = new Point2()): Point2 {
    if (typeof out === `undefined`) {
      out = new Point2()
    }

    if (false) {
      if (!offset) {
        offset = {x: 0, y: 0}

      }
    } else {
      //offset = {x: 0, y: 0}
    }

    out.x = ( point.x - point.y) * this._transform[0]
    out.y = ((point.x + point.y) * this._transform[1]) - point.z

    out.x += this.camera.width * this.anchor.x
    out.y += this.camera.height * this.anchor.y

  if (offset) {
    out.x += offset.x
    out.y += offset.y
  }

    return out
  }

  /**
   * Use axonometric projection to transform a 3D Point3 coordinate to a 2D Point coordinate, ignoring the z-axis. If given the coordinates will be set into the object, otherwise a brand new Point object will be created and returned.
   * @method Projector#projectXY
   * @param {Point3} point - The Point3 to project from.
   * @param {Point2} out - The Point to project to.
   * @return {Point2} The transformed Point.
   */
  projectXY(point: Point3Like, out: Point2 = new Point2()): Point2 {
    if (typeof out === `undefined`) {
      out = new Point2()
    }

    out.x = (point.x - point.y) * this._transform[0]
    out.y = (point.x + point.y) * this._transform[1]

    out.x += this.camera.width * this.anchor.x
    out.y += this.camera.height * this.anchor.y

    return out
  }

  /**
   * Use reverse axonometric projection to transform a 2D Point coordinate to a 3D Point3 coordinate. If given the coordinates will be set into the object, otherwise a brand new Point3 object will be created and returned.
   * @method Projector#unproject
   * @param {Point} point - The Point to project from.
   * @param {Point3} out - The Point3 to project to.
   * @param {number} [z] - Specified z-plane to project to.
   * @return {Point3} The transformed Point3.
   */
  unproject(point: Point2Like, out: Point3 = new Point3(), z = 0): Point3 {
    if (typeof out === `undefined`) {
      out = new Point3()
    }

    z = z || 0

    const x = point.x + this.camera.x - this.camera.width * this.anchor.x
    const y = point.y + this.camera.y - this.camera.height * this.anchor.y + z

    out.x = x /( 2 * this._transform[0]) + y /( 2 * this._transform[1])
    out.y = - (x/(2*this._transform[0]))+ y /( 2 * this._transform[1])
    out.z = z

    //lll(point, out.x / 40, out.y / 40, this.camera.x, this.camera.y)
    return out
  }

  /**
   * Use reverse axonometric projection to transform a 2D Point coordinate to a 3D Point3 coordinate. If given the coordinates will be set into the object, otherwise a brand new Point3 object will be created and returned.
   * @method Projector#unproject
   * @param {Point2} point - The Point to project from.
   * @param {Point3} out - The Point3 to project to.
   * @param {number} [z] - Specified z-plane to project to.
   * @return {Point3} The transformed Point3.
   */
  unprojectAbsolute(point: Point2Like, out: Point3 = new Point3(), z = 0): Point3 {
    if (typeof out === `undefined`) {
      out = new Point3()
    }

    z = z || 0

    const x = point.x // - (this.cameras.main.width * this.anchor.x);
    const y = point.y // - (this.cameras.main.height * this.anchor.y) + z;

    out.x = x /( 2 * this._transform[0]) + y /( 2 * this._transform[1])
    out.y = - (x/(2*this._transform[0]))+ y /( 2 * this._transform[1])
    out.z = z

    return out
  }

  /**
   * Perform a simple depth sort on all IsoSprites in the passed group. This function is fast and will accurately sort items on a single z-plane, but breaks down when items are above/below one another in certain configurations.
   *
   * @method Projector#simpleSort
   * @param {Phaser.Group} group - A group of IsoSprites to sort.
   */
  simpleSort(group: { sort(property: 'depth'): void }) {
    group.sort(`depth`)
  }

  /**
   * Perform a volume-based topological sort on all IsoSprites in the passed group or array. Will use the body if available, otherwise it will use an automatically generated bounding cube. If a group is passed, <code>Phaser.Group#sort</code> is automatically called on the specified property.
   * Routine adapted from this tutorial: http://mazebert.com/2013/04/18/isometric-depth-sorting/
   *
   * @method Projector#topologicalSort
   * @param {Phaser.GameObjects.Group|array} group - A group or array of IsoSprites to sort.
   * @param {number} [padding] - The amount of extra tolerance in the depth sorting; larger values reduce flickering when objects collide, but also introduce inaccuracy when objects are close. Defaults to 1.5.
   * @param {string} [prop] - The property to store the depth information on. If not specified, it will default to 'isoDepth'.
   */
  topologicalSort(groups: (DepthSprite[] | null | undefined)[], padding = 0.1, prop = 'isoDepth') {
    let objectLists: DepthSprite[][] = []

    for (let i = 0; i < groups.length; i++) {
      let group = groups[i]
      if (!group) continue

      if (Array.isArray(group)) {
        objectLists.push(group)
      } else {
        console.log(group)
      }
    }

    prop = prop || `isoDepth`

    if (typeof padding === `undefined`) {
      padding = 0.1
    }

    for (let o = 0; o < objectLists.length; o++) {
      let children = objectLists[o]
      const len = children.length

      for (let i = 0; i < len; i++) {
        let a = children[i]
        let behindIndex = 0
        if (!a.isoSpritesBehind) {
          a.isoSpritesBehind = []
        }

        for (let j = 0; j < len; j++) {
          if (i == j) continue

          let b = children[j]
          let bounds = /*a.body ||*/ a.isoBounds

          if (
            b._isoPosition.x + padding < bounds.frontX - padding &&
            b._isoPosition.y + padding < bounds.frontY - padding &&
            b._isoPosition.z + padding < bounds.top - padding
          ) {
            a.isoSpritesBehind[behindIndex++] = b
            //console.log(bounds)
          }
        }
        a.isoVisitedFlag = false
      }
    }

    let _sortDepth = 0

    function visitNode(node: DepthSprite) {
      if (node.isoVisitedFlag !== false) return

      node.isoVisitedFlag = true
      const spritesBehindLength = node.isoSpritesBehind!.length
      for (let k = 0; k < spritesBehindLength; k++) {
        if (node.isoSpritesBehind![k] === null) {
          break
        } else {
          visitNode(node.isoSpritesBehind![k]!)
          node.isoSpritesBehind![k] = null
        }
      }

      Reflect.set(node, prop, _sortDepth++)
    }

    for (let o = 0; o < objectLists.length; o++) {
      let children = objectLists[o]
      const len = children.length

      for (let i = 0; i < len; i++) {
        visitNode(children[i])
      }

      for (let i = 0; i < len; i++) {
        let child = children[i]

        child.postUpdate()

        let pos = child._isoPosition
        //let x = (pos.x - pos.y) - child.displayOriginX;
        //let y = ((pos.x + pos.y) / 2) - child.displayOriginY;

        //child.depth = x * y; //Math.round((child._isoPosition.x * (child._isoPosition.y * 64)) / 40);
        child.depth =
          child._isoPosition.x *( child._isoPosition.y * 64) -
          child.displayOriginY
        //child.depth = children[i][prop];

        //child.debug();
      }
    }
  }
}
