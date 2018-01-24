import { Phaser } from './Phaser';
import { Point3 } from './Point3';
import { Isometric } from './Isometric';
import { Math } from './Math';

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

export class Projector {
    constructor(scene, projectionAngle) {

        /**
         * @property {Phaser.Game} game - The current game object.
         */
        this.scene = scene;

        /**
         * @property {array} _transform - The pre-calculated axonometric transformation values.
         * @private
         */
        this._transform = null;

        /**
         * @property {number} _projectionAngle - The cached angle of projection in radians.
         * @private
         */
        this._projectionAngle = 0;

        /**
         * @property {number} projectionAngle - The angle of projection in radians.
         * @default
         */
        this.projectionAngle = 26.565;  //projectionAngle || Isometric.CLASSIC;

        /**
         * @property {Phaser.Geom.Point} anchor - The x and y offset multipliers as a ratio of the game world size.
         * @default
         */
        this.anchor = new Phaser.Geom.Point(0.5, 0.5);
    }

    /**
     * Use axonometric projection to transform a 3D Point3 coordinate to a 2D Point coordinate. If given the coordinates will be set into the object, otherwise a brand new Point object will be created and returned.
     * @method Projector#project
     * @param {Point3} point3 - The Point3 to project from.
     * @param {Phaser.Geom.Point} out - The Point to project to.
     * @return {Phaser.Geom.Point} The transformed Point.
     */
    project(point3, out) {
        if (typeof out === "undefined") {
            out = new Phaser.Geom.Point();
        }

        out.x = (point3.x - point3.y) * this._transform[0];
        out.y = ((point3.x + point3.y) * this._transform[1]) - point3.z;

        out.x += this.scene.cameras.main.width * this.anchor.x;
        out.y += this.scene.cameras.main.height * this.anchor.y;

        return out;
    }

    /**
     * Use axonometric projection to transform a 3D Point3 coordinate to a 2D Point coordinate, ignoring the z-axis. If given the coordinates will be set into the object, otherwise a brand new Point object will be created and returned.
     * @method Projector#projectXY
     * @param {Point3} point3 - The Point3 to project from.
     * @param {Phaser.Geom.Point} out - The Point to project to.
     * @return {Phaser.Geom.Point} The transformed Point.
     */
    projectXY(point3, out) {
        if (typeof out === "undefined") {
            out = new Phaser.Geom.Point();
        }

        out.x = (point3.x - point3.y) * this._transform[0];
        out.y = (point3.x + point3.y) * this._transform[1];

        out.x += this.scene.cameras.main.width * this.anchor.x;
        out.y += this.scene.cameras.main.height * this.anchor.y;

        return out;
    }

    /**
     * Use reverse axonometric projection to transform a 2D Point coordinate to a 3D Point3 coordinate. If given the coordinates will be set into the object, otherwise a brand new Point3 object will be created and returned.
     * @method Projector#unproject
     * @param {Point} point - The Point to project from.
     * @param {Point3} out - The Point3 to project to.
     * @param {number} [z] - Specified z-plane to project to.
     * @return {Point3} The transformed Point3.
     */
    unproject(point, out, z) {
        if (typeof out === "undefined") {
            out = new Point3();
        }

        z = z || 0;

        const x = point.x - this.scene.cameras.main.x - (this.scene.cameras.main.width * this.anchor.x);
        const y = point.y - this.scene.cameras.main.y - (this.scene.cameras.main.height * this.anchor.y) + z;

        out.x = x / (2 * this._transform[0]) + y / (2 * this._transform[1]);
        out.y = -(x / (2 * this._transform[0])) + y / (2 * this._transform[1]);
        out.z = z;

        return out;
    }

  /**
   * Use reverse axonometric projection to transform a 2D Point coordinate to a 3D Point3 coordinate. If given the coordinates will be set into the object, otherwise a brand new Point3 object will be created and returned.
   * @method Projector#unproject
   * @param {Point} point - The Point to project from.
   * @param {Point3} out - The Point3 to project to.
   * @param {number} [z] - Specified z-plane to project to.
   * @return {Point3} The transformed Point3.
   */
  unprojectAbsolute(point, out, z) {
    if (typeof out === "undefined") {
      out = new Point3();
    }

    z = z || 0;

    const x = point.x - (this.scene.cameras.main.width * this.anchor.x);
    const y = point.y - (this.scene.cameras.main.height * this.anchor.y) + z;

    out.x = x / (2 * this._transform[0]) + y / (2 * this._transform[1]);
    out.y = -(x / (2 * this._transform[0])) + y / (2 * this._transform[1]);
    out.z = z;

    return out;
  }

    /**
     * Perform a simple depth sort on all IsoSprites in the passed group. This function is fast and will accurately sort items on a single z-plane, but breaks down when items are above/below one another in certain configurations.
     *
     * @method Projector#simpleSort
     * @param {Phaser.Group} group - A group of IsoSprites to sort.
     */
    simpleSort(group) {
        group.sort("depth");
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
    topologicalSort(group, padding, prop) {
        let children;
        let isGroup;

        if (group instanceof Phaser.GameObjects.Group) {
            children = group.getChildren();
            isGroup = true;
        }
        else if (group.length) {
            children = group;
        }
        else {
            return;
        }

        prop = prop || "isoDepth";

        if (typeof padding === "undefined") {
            padding = 1.5;
        }

        let a;
        let b;
        let i;
        let j;
        let bounds;
        let behindIndex;
        const len = children.length;

        for (i = 0; i < len; i++) {
            a = children[i];
            behindIndex = 0;
            if (!a.isoSpritesBehind) {
                a.isoSpritesBehind = [];
            }

            for (j = 0; j < len; j++) {
                if (i != j) {
                    b = children[j];
                    bounds = a.body || a.isoBounds;
                    if (b._isoPosition.x + padding < bounds.frontX - padding && b._isoPosition.y + padding < bounds.frontY - padding && b._isoPosition.z + padding < bounds.top - padding) {
                        a.isoSpritesBehind[behindIndex++] = b;
                    }
                }
            }
            a.isoVisitedFlag = false;
        }

        let _sortDepth = 0;

        function visitNode(node) {
            if (node.isoVisitedFlag === false) {
                node.isoVisitedFlag = true;
                const spritesBehindLength = node.isoSpritesBehind.length;
                for (let k = 0; k < spritesBehindLength; k++) {
                    if (node.isoSpritesBehind[k] === null) {
                        break;
                    }
                    else {
                        visitNode(node.isoSpritesBehind[k]);
                        node.isoSpritesBehind[k] = null;
                    }
                }

                node[prop] = _sortDepth++;
            }
        }

        for (i = 0; i < len; i++) {
            visitNode(children[i]);
        }

      for (i = 0; i < len; i++) {
          children[i].setDepth(children[i].depth);
      }

        if (isGroup) {
            //group.sort(prop);
        }
    }

    /**
     * @name Projector#projectionAngle
     * @property {number} projectionAngle - The angle of axonometric projection.
     */
    get projectionAngle() {
        return this._projectionAngle;
    }

    set projectionAngle(value) {

        if (value === this._projectionAngle) {
            return;
        }

        this._projectionAngle = value;
// 1.1071487177940904 (2) [0.8944271909999159, 0.44721359549995804]


      //this._transform = [Math.sin(this._projectionAngle), Math.cos(this._projectionAngle)];

      //console.log(this._projectionAngle,  this._transform)

        //this._transform = [Math.cos(this._projectionAngle * Math.PI / 180), Math.sin(this._projectionAngle * Math.PI / 180)];

      this._transform = [0.975, 0.5];
    }
}
