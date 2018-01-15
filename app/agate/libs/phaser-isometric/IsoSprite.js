import { Phaser } from './Phaser';
import { Isometric } from './Isometric';
import { Point3 } from './Point3';
import { Cube } from './Cube';


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

export class IsoSprite extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, z, key, frame) {

        super(scene, x, y, key, frame);

        //this.scale = {x: 1.0, y: 1.0};
        //this.anchor = {x: 0.0, y: 0.0};

        /**
         * @property {number} type - The const type of this object.
         * @readonly
         */
        this.type = Isometric.ISOSPRITE;

        /**
         * @property {Point3} _isoPosition - Internal 3D position.
         * @private
         */
        this._isoPosition = new Point3(x, y, z);

        /**
         * @property {number} snap - Snap this IsoSprite's position to the specified value; handy for keeping pixel art snapped to whole pixels.
         * @default
         */
        this.snap = 0;

        /**
         * @property {number} _depth - Internal cached depth value.
         * @readonly
         * @private
         */
        this._depth = 0;

        /**
         * @property {boolean} _depthChanged - Internal invalidation control for depth management.
         * @readonly
         * @private
         */
        this._depthChanged = true;

        /**
         * @property {boolean} _isoPositionChanged - Internal invalidation control for positioning.
         * @readonly
         * @private
         */
        this._isoPositionChanged = true;

        /**
         * @property {boolean} _isoBoundsChanged - Internal invalidation control for isometric bounds.
         * @readonly
         * @private
         */
        this._isoBoundsChanged = true;

        this._project();

        /**
         * @property {Cube} _isoBounds - Internal derived 3D bounds.
         * @private
         */
        this._isoBounds = this.resetIsoBounds();
    }

    /**
     * Internal function called by the World postUpdate cycle.
     *
     * @method IsoSprite#postUpdate
     * @memberof IsoSprite
     */
    postUpdate() {
        super.postUpdate();
        this._project();
    }

    /**
     * Internal function that performs the axonometric projection from 3D to 2D space.
     * @method IsoSprite#_project
     * @memberof IsoSprite
     * @private
     */
    _project() {
        if (this._isoPositionChanged) {
            var pos = this.scene.iso.project(this._isoPosition);

            if (this.snap > 0) {
                    this.setPosition(
                        Phaser.Math.snapTo(pos.x, this.snap),
                        Phaser.Math.snapTo(pos.y, this.snap)
                    );
            } else {
                this.setPosition(pos.x, pos.y);
            }

            //this._depthChanged = this._isoPositionChanged = this._isoBoundsChanged = true;
            // https://github.com/lewster32/phaser-plugin-isometric/issues/46
            this._isoPositionChanged = false;
            this._depthChanged = this._isoBoundsChanged = true;
        }
    }

    resetIsoBounds() {
        if (typeof this._isoBounds === "undefined") {
            this._isoBounds = new Cube();
        }

        const asx = Math.abs(this.scaleX);
        const asy = Math.abs(this.scaleY);

        /*this._isoBounds.widthX = Math.round(Math.abs(this.width) * 0.5) * asx;
        this._isoBounds.widthY = Math.round(Math.abs(this.width) * 0.5) * asx;
        this._isoBounds.height = Math.round(Math.abs(this.height) - (Math.abs(this.width) * 0.5)) * asy;

        this._isoBounds.x = this.isoX + (this._isoBounds.widthX * -this.originX) + this._isoBounds.widthX * 0.5;
        this._isoBounds.y = this.isoY + (this._isoBounds.widthY * this.originX) - this._isoBounds.widthY * 0.5;
        this._isoBounds.z = this.isoZ - (Math.abs(this.height) * (1 - this.originY)) + (Math.abs(this.width * 0.5));*/



        var _tileWidth = 80//Math.abs(this.width);
        var _tileHeight = 40//Math.abs(this.width) * Math.tan(this.scene.iso.projectionAngle);

        this._isoBounds.widthX = Math.round(Math.sqrt(Math.pow(_tileWidth, 2) + Math.pow(_tileHeight, 2)) * 0.5) * asx;
        this._isoBounds.widthY = Math.round(Math.sqrt(Math.pow(_tileWidth, 2) + Math.pow(_tileHeight, 2)) * 0.5) * asx;
        this._isoBounds.height = Math.round(Math.abs(this.height) - _tileHeight) * asy;

        this._isoBounds.x = this.isoX + (this._isoBounds.widthX * -this.originX) + (this._isoBounds.widthX * 0.5) - (this._isoBounds.widthX * this.originY);
        this._isoBounds.y = this.isoY + (this._isoBounds.widthY * this.originX) - (this._isoBounds.widthY * 0.5) - (this._isoBounds.widthY * this.originY);
        this._isoBounds.z = this.isoZ - this._isoBounds.height * (1 - this.originY);

        return this._isoBounds;
    }

    /**
     * The axonometric position of the IsoSprite on the x axis. Increasing the x coordinate will move the object down and to the right on the screen.
     *
     * @name IsoSprite#isoX
     * @property {number} isoX - The axonometric position of the IsoSprite on the x axis.
     */
    get isoX() {
        return this._isoPosition.x;
    }

    set isoX(value) {
        this._isoPosition.x = value;
        this._depthChanged = this._isoPositionChanged = this._isoBoundsChanged = true;
        if (this.body){
            this.body._reset = true;
        }
    }

    /**
     * The axonometric position of the IsoSprite on the y axis. Increasing the y coordinate will move the object down and to the left on the screen.
     *
     * @name IsoSprite#isoY
     * @property {number} isoY - The axonometric position of the IsoSprite on the y axis.
     */
    get isoY() {
        return this._isoPosition.y;
    }

    set isoY(value) {
        this._isoPosition.y = value;
        this._depthChanged = this._isoPositionChanged = this._isoBoundsChanged = true;
        if (this.body){
            this.body._reset = true;
        }
    }

    /**
     * The axonometric position of the IsoSprite on the z axis. Increasing the z coordinate will move the object directly upwards on the screen.
     *
     * @name IsoSprite#isoZ
     * @property {number} isoZ - The axonometric position of the IsoSprite on the z axis.
     */
    get isoZ() {
        return this._isoPosition.z;
    }

    set isoZ(value) {
        this._isoPosition.z = value;
        this._depthChanged = this._isoPositionChanged = this._isoBoundsChanged = true;
        if (this.body){
            this.body._reset = true;
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
        return this._isoPosition;
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
            this.resetIsoBounds();
            this._isoBoundsChanged = false;
        }
        return this._isoBounds;
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
            this._depth = (this._isoPosition.x + this._isoPosition.y) + (this._isoPosition.z * 1.25);
            this._depthChanged = false;
        }
        return this._depth;
    }
}
