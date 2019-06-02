import Phaser from './Phaser'
import Isometric from './Isometric'
import Point3 from './Point3'
import Cube from './Cube'
import Math from './Math'

/**
 * @class IsoSprite
 *
 * @classdesc
 * Create a new `IsoSprite` object. IsoSprites are extended versions of standard Sprites that are suitable for axonometric positioning.
 *
 * IsoSprites are simply Sprites that have three new position properties (isoX, isoY and isoZ) and ask the instance of Projector what their position should be in a 2D scene whenever these properties are changed.
 * The IsoSprites retain their 2D position property to prevent any problems and allow you to interact with them as you would a normal Sprite. The upside of this simplicity is that things should behave predictably for those already used to Phaser.
 *
 * @constructor
 * @extends Phaser.Sprite
 * @param {Phaser.Scene} game - A reference to the currently running scene.
 * @param {number} x - The x coordinate (in 3D space) to position the IsoSprite at.
 * @param {number} y - The y coordinate (in 3D space) to position the IsoSprite at.
 * @param {number} z - The z coordinate (in 3D space) to position the IsoSprite at.
 * @param {string|Phaser.RenderTexture|Phaser.BitmapData|PIXI.Texture} key - This is the image or texture used by the IsoSprite during rendering. It can be a string which is a reference to the Cache entry, or an instance of a RenderTexture or PIXI.Texture.
 * @param {string|number} frame - If this IsoSprite is using part of a sprite sheet or texture atlas you can specify the exact frame to use by giving a string or numeric index.
 */

export default class IsoSprite extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, z, key, frame, offset) {
    super(scene, undefined, undefined, key, frame)

    //this.offset = offset;
    //this.anchor = {x: 0.0, y: 0.0};

    this.originX = 0.0
    this.originY = 0.0

    /**
     * @property {number} type - The const type of this object.
     * @readonly
     */
    this.type = Isometric.ISOSPRITE

    if (false) {
      let pos = { x: this.frame.centerX, y: this.frame.centerY }
      if (offset != null) {
        pos.x -= offset[0]
        pos.y -= offset[1]
      }

      this.displayOriginX = pos.x
      this.displayOriginY = pos.y
    } else {
      if (offset != null) {
        offset = this.scene.iso.unprojectAbsolute({
          x: offset[0],
          y: offset[1]
        })

        x += offset.x
        y += offset.y
      }

      this.displayOriginX = this.frame.centerX
      this.displayOriginY = this.frame.centerY
    }

    /**
     * @property {Point3} _isoPosition - Internal 3D position.
     * @private
     */
    this._isoPosition = new Point3(x, y, z)

    /**
     * @property {number} snap - Snap this IsoSprite's position to the specified value; handy for keeping pixel art snapped to whole pixels.
     * @default
     */
    this.snap = 0

    /**
     * @property {number} _depth - Internal cached depth value.
     * @readonly
     * @private
     */
    //this._depth = 0;

    /**
     * @property {boolean} _depthChanged - Internal invalidation control for depth management.
     * @readonly
     * @private
     */
    this._depthChanged = true

    /**
     * @property {boolean} _isoPositionChanged - Internal invalidation control for positioning.
     * @readonly
     * @private
     */
    this._isoPositionChanged = true

    /**
     * @property {boolean} _isoBoundsChanged - Internal invalidation control for isometric bounds.
     * @readonly
     * @private
     */
    this._isoBoundsChanged = true

    this._project()

    /**
     * @property {Cube} _isoBounds - Internal derived 3D bounds.
     * @private
     */
    this._isoBounds = this.resetIsoBounds()
  }

  /**
   * Internal function called by the World postUpdate cycle.
   *
   * @method IsoSprite#postUpdate
   * @memberof IsoSprite
   */
  postUpdate() {
    //super.postUpdate();
    this._project()
  }

  /**
   * Internal function that performs the axonometric projection from 3D to 2D space.
   * @method IsoSprite#_project
   * @memberof IsoSprite
   * @private
   */
  _project() {
    if (!this._isoPositionChanged) return

    let pos = this.scene.iso.project(this._isoPosition)

    /*let offset = this.offset;
    if (offset != null) {
      pos.x += offset.x;
      pos.y += offset.y;
    }*/

    //this.displayOriginX = frame.centerX;
    //this.displayOriginY = frame.centerY;

    if (this.snap > 0) {
      this.setPosition(
        Phaser.Math.snapTo(pos.x, this.snap),
        Phaser.Math.snapTo(pos.y, this.snap)
      )
    } else {
      this.setPosition(pos.x, pos.y)
    }

    this._isoPositionChanged = false
    this._depthChanged = this._isoBoundsChanged = true
  }

  resetIsoBounds() {
    if (typeof this._isoBounds === `undefined`) {
      this._isoBounds = new Cube()
    }

    const asx = Math.abs(this.scaleX)
    const asy = Math.abs(this.scaleY)

    let bounds = this._isoBounds

    let x =
      this.scaleX < 0
        ? this.frame.width - this.displayOriginX
        : this.displayOriginX

    let anchor = { x: x / this.width, y: this.displayOriginY / this.height }

    if (false) {
      bounds.widthX = Math.round(Math.abs(this.width) * 0.5) * asx
      bounds.widthY = Math.round(Math.abs(this.width) * 0.5) * asx
      bounds.height =
        Math.round(Math.abs(this.height) - Math.abs(this.width) * 0.5) * asy

      bounds.x = this.isoX + bounds.widthX * -anchor.x + bounds.widthX * 0.5
      bounds.y = this.isoY + bounds.widthY * anchor.x - bounds.widthY * 0.5
      bounds.z =
        this.isoZ -
        Math.abs(this.height) * (1 - anchor.y) +
        Math.abs(this.width * 0.5)
    } else {
      let tileWidth = Math.abs(this.width) * this.scene.iso._transform[0]
      let tileHeight = Math.abs(this.width) * this.scene.iso._transform[1] //* Math.tan(this.scene.iso.projectionAngle);

      bounds.widthX =
        Math.round(
          Math.sqrt(Math.pow(tileWidth, 2) + Math.pow(tileHeight, 2)) * 0.5
        ) * asx
      bounds.widthY = bounds.widthX //Math.round(Math.sqrt(Math.pow(tileWidth, 2) + Math.pow(tileHeight, 2)) * 0.5) * asx;
      bounds.height = Math.round(Math.abs(this.height) - tileHeight) * asy

      bounds.x =
        this.isoX +
        bounds.widthX * -anchor.x +
        bounds.widthX * 0.5 -
        bounds.widthX * anchor.y
      bounds.y =
        this.isoY +
        bounds.widthY * anchor.x -
        bounds.widthY * 0.5 -
        bounds.widthY * anchor.y
      bounds.z = this.isoZ - bounds.height * (1 - anchor.y)
    }

    return bounds
  }

  /**
   * The axonometric position of the IsoSprite on the x axis. Increasing the x coordinate will move the object down and to the right on the screen.
   *
   * @name IsoSprite#isoX
   * @property {number} isoX - The axonometric position of the IsoSprite on the x axis.
   */
  get isoX() {
    return this._isoPosition.x
  }

  set isoX(value) {
    this._isoPosition.x = value
    this._depthChanged = this._isoPositionChanged = this._isoBoundsChanged = true
    if (this.body) {
      this.body._reset = true
    }
  }

  /**
   * The axonometric position of the IsoSprite on the y axis. Increasing the y coordinate will move the object down and to the left on the screen.
   *
   * @name IsoSprite#isoY
   * @property {number} isoY - The axonometric position of the IsoSprite on the y axis.
   */
  get isoY() {
    return this._isoPosition.y
  }

  set isoY(value) {
    this._isoPosition.y = value
    this._depthChanged = this._isoPositionChanged = this._isoBoundsChanged = true
    if (this.body) {
      this.body._reset = true
    }
  }

  /**
   * The axonometric position of the IsoSprite on the z axis. Increasing the z coordinate will move the object directly upwards on the screen.
   *
   * @name IsoSprite#isoZ
   * @property {number} isoZ - The axonometric position of the IsoSprite on the z axis.
   */
  get isoZ() {
    return this._isoPosition.z
  }

  set isoZ(value) {
    this._isoPosition.z = value
    this._depthChanged = this._isoPositionChanged = this._isoBoundsChanged = true
    if (this.body) {
      this.body._reset = true
    }
  }

  /**
   * A Point3 object representing the axonometric position of the IsoSprite.
   *
   * @name IsoSprite#isoPosition
   * @property {Point3} isoPosition - The axonometric position of the IsoSprite.
   * @readonly
   */
  get isoPosition() {
    return this._isoPosition
  }

  set isoPosition(position) {
    this._isoPosition = position
    this._depthChanged = this._isoPositionChanged = this._isoBoundsChanged = true
    if (this.body) {
      this.body._reset = true
    }
  }

  isoMove(x, y) {
    this._isoPosition.add(x, y, 0)
    this._depthChanged = this._isoPositionChanged = this._isoBoundsChanged = true
    if (this.body) {
      this.body._reset = true
    }
  }

  /**
   * A Cube object representing the derived boundsof the IsoSprite.
   *
   * @name IsoSprite#isoBounds
   * @property {Point3} isoBounds - The derived 3D bounds of the IsoSprite.
   * @readonly
   */
  get isoBounds() {
    if (this._isoBoundsChanged || !this._isoBounds) {
      this.resetIsoBounds()
      this._isoBoundsChanged = false
    }
    return this._isoBounds
  }

  /**
   * The non-unit distance of the IsoSprite from the 'front' of the scene. Used to correctly depth sort a group of IsoSprites.
   *
   * @name IsoSprite#depth
   * @property {number} depth - A calculated value used for depth sorting.
   * @readonly
   */
  get depth() {
    if (this._depthChanged === true) {
      super.depth =
        this._isoPosition.x + this._isoPosition.y + this._isoPosition.z * 1.25
      this._depthChanged = false
    }
    return super.depth
  }

  set depth(depth) {
    super.depth = depth
  }

  debug(color) {
    if (!this.isoBounds) {
      return
    }

    color = color || 0x00aa00

    const corners = this.isoBounds.getCorners()

    let camera = this.scene.cameras.main
    const posX = -camera.x
    const posY = -camera.y

    let graphics = this.scene.add.graphics({ x: 0, y: 0 })

    graphics.lineStyle(1, color)

    let points = corners.slice(0, corners.length)
    points = points.map(p => {
      const newPos = this.scene.iso.project(p)
      //newPos.x += posX;
      //newPos.y += posY;
      return newPos
    })

    graphics.beginPath()
    graphics.moveTo(points[0].x, points[0].y)
    graphics.lineTo(points[1].x, points[1].y)
    graphics.lineTo(points[3].x, points[3].y)
    graphics.lineTo(points[2].x, points[2].y)
    graphics.lineTo(points[6].x, points[6].y)
    graphics.lineTo(points[4].x, points[4].y)
    graphics.lineTo(points[5].x, points[5].y)
    graphics.lineTo(points[1].x, points[1].y)
    graphics.lineTo(points[0].x, points[0].y)
    graphics.lineTo(points[4].x, points[4].y)
    graphics.moveTo(points[0].x, points[0].y)
    graphics.lineTo(points[2].x, points[2].y)
    graphics.moveTo(points[3].x, points[3].y)
    graphics.lineTo(points[7].x, points[7].y)
    graphics.lineTo(points[6].x, points[6].y)
    graphics.moveTo(points[7].x, points[7].y)
    graphics.lineTo(points[5].x, points[5].y)
    graphics.closePath()

    graphics.strokePath()
  }
}
