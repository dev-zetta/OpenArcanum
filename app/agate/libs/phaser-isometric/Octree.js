import { Cube } from './Cube';

/**
 * Octree Constructor
 *
 * @class Octree
 * @classdesc A Octree implementation based on Phaser.QuadTree.
 * Original version at https://github.com/timohausmann/quadtree-js/
 *
 * @constructor
 * @param {number} x - The bottom-back coordinate of the octree.
 * @param {number} y - The bottom-back coordinate of the octree.
 * @param {number} z - The bottom-back coordinate of the octree.
 * @param {number} widthX - The width X (breadth) of the octree.
 * @param {number} widthY - The width Y (depth) of the octree.
 * @param {number} height - The height (Z) of the octree.
 * @param {number} [maxObjects=10] - The maximum number of objects per node.
 * @param {number} [maxLevels=4] - The maximum number of levels to iterate to.
 * @param {number} [level=0] - Which level is this?
 */
export class Octree {
    constructor(x, y, z, widthX, widthY, height, maxObjects, maxLevels, level) {

        /**
         * @property {number} maxObjects - The maximum number of objects per node.
         * @default
         */
        this.maxObjects = 10;

        /**
         * @property {number} maxLevels - The maximum number of levels to break down to.
         * @default
         */
        this.maxLevels = 4;

        /**
         * @property {number} level - The current level.
         */
        this.level = 0;

        /**
         * @property {object} bounds - Object that contains the octree bounds.
         */
        this.bounds = {};

        /**
         * @property {array} objects - Array of octree children.
         */
        this.objects = [];

        /**
         * @property {array} nodes - Array of associated child nodes.
         */
        this.nodes = [];

        /**
         * @property {array} _empty - Internal empty array.
         * @private
         */
        this._empty = [];

        this.reset(x, y, z, widthX, widthY, height, maxObjects, maxLevels, level);

    }

    /**
     * Resets the QuadTree.
     *
     * @method Octree#reset
     * @param {number} x - The bottom-back coordinate of the octree.
     * @param {number} y - The bottom-back coordinate of the octree.
     * @param {number} z - The bottom-back coordinate of the octree.
     * @param {number} widthX - The width X (breadth) of the octree.
     * @param {number} widthY - The width Y (depth) of the octree.
     * @param {number} height - The height (Z) of the octree.
     * @param {number} [maxObjects=10] - The maximum number of objects per node.
     * @param {number} [maxLevels=4] - The maximum number of levels to iterate to.
     * @param {number} [level=0] - Which level is this?
     */
    reset(x, y, z, widthX, widthY, height, maxObjects, maxLevels, level) {

        this.maxObjects = maxObjects || 10;
        this.maxLevels = maxLevels || 4;
        this.level = level || 0;

        this.bounds = {
            x: Math.round(x),
            y: Math.round(y),
            z: Math.round(z),
            widthX,
            widthY,
            height,
            subWidthX: Math.floor(widthX * 0.5),
            subWidthY: Math.floor(widthY * 0.5),
            subHeight: Math.floor(height * 0.5),
            frontX: Math.round(x) + Math.floor(widthX * 0.5),
            frontY: Math.round(y) + Math.floor(widthY * 0.5),
            top: Math.round(z) + Math.floor(height * 0.5)
        };

        this.objects.length = 0;
        this.nodes.length = 0;

    }

    /**
     * Populates this octree with the children of the given Group. In order to be added the child must exist and have a body property.
     *
     * @method Octree#populate
     * @param {Phaser.Group} group - The Group to add to the octree.
     */
    populate(group) {

        group.forEach(this.populateHandler, this, true);

    }

    /**
     * Handler for the populate method.
     *
     * @method Octree#populateHandler
     * @param {IsoSprite|object} sprite - The Sprite to check.
     */
    populateHandler(sprite) {

        if (sprite.body && sprite.exists) {
            this.insert(sprite.body);
        }

    }

    /**
     * Split the node into 8 subnodes
     *
     * @method Octree#split
     */
    split() {

        //  bottom four octants
        //  -x-y-z
        this.nodes[0] = new Octree(this.bounds.x, this.bounds.y, this.bounds.z, this.bounds.subWidthX, this.bounds.subWidthY, this.bounds.subHeight, this.maxLevels, (this.level + 1));
        //  +x-y-z
        this.nodes[1] = new Octree(this.bounds.frontX, this.bounds.y, this.bounds.z, this.bounds.subWidthX, this.bounds.subWidthY, this.bounds.subHeight, this.maxLevels, (this.level + 1));
        //  -x+y-z
        this.nodes[2] = new Octree(this.bounds.x, this.bounds.frontY, this.bounds.z, this.bounds.subWidthX, this.bounds.subWidthY, this.bounds.subHeight, this.maxLevels, (this.level + 1));
        //  +x+y-z
        this.nodes[3] = new Octree(this.bounds.frontX, this.bounds.frontY, this.bounds.z, this.bounds.subWidthX, this.bounds.subWidthY, this.bounds.subHeight, this.maxLevels, (this.level + 1));

        //  top four octants
        //  -x-y+z
        this.nodes[4] = new Octree(this.bounds.x, this.bounds.y, this.bounds.top, this.bounds.subWidthX, this.bounds.subWidthY, this.bounds.subHeight, this.maxLevels, (this.level + 1));
        //  +x-y+z
        this.nodes[5] = new Octree(this.bounds.frontX, this.bounds.y, this.bounds.top, this.bounds.subWidthX, this.bounds.subWidthY, this.bounds.subHeight, this.maxLevels, (this.level + 1));
        //  -x+y+z
        this.nodes[6] = new Octree(this.bounds.x, this.bounds.frontY, this.bounds.top, this.bounds.subWidthX, this.bounds.subWidthY, this.bounds.subHeight, this.maxLevels, (this.level + 1));
        //  +x+y+z
        this.nodes[7] = new Octree(this.bounds.frontX, this.bounds.frontY, this.bounds.top, this.bounds.subWidthX, this.bounds.subWidthY, this.bounds.subHeight, this.maxLevels, (this.level + 1));
    }

    /**
     * Insert the object into the node. If the node exceeds the capacity, it will split and add all objects to their corresponding subnodes.
     *
     * @method Octree#insert
     * @param {Body|Cube|object} body - The Body object to insert into the octree. Can be any object so long as it exposes x, y, z, frontX, frontY and top properties.
     */
    insert(body) {

        let i = 0;
        let index;

        //  if we have subnodes ...
        if (this.nodes[0] != null) {
            index = this.getIndex(body);

            if (index != -1) {
                this.nodes[index].insert(body);
                return;
            }
        }

        this.objects.push(body);

        if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
            //  Split if we don't already have subnodes
            if (this.nodes[0] == null) {
                this.split();
            }

            //  Add objects to subnodes
            while (i < this.objects.length) {
                index = this.getIndex(this.objects[i]);

                if (index != -1) {
                    //  this is expensive - see what we can do about it
                    this.nodes[index].insert(this.objects.splice(i, 1)[0]);
                } else {
                    i++;
                }
            }
        }

    }

    /**
     * Determine which node the object belongs to.
     *
     * @method Octree#getIndex
     * @param {Cube|object} cube - The bounds in which to check.
     * @return {number} index - Index of the subnode (0-7), or -1 if cube cannot completely fit within a subnode and is part of the parent node.
     */
    getIndex(cube) {

        //  default is that cube doesn't fit, i.e. it straddles the internal octants
        let index = -1;

        if (cube.x < this.bounds.frontX && cube.frontX < this.bounds.frontX) {
            if (cube.y < this.bounds.frontY && cube.frontY < this.bounds.frontY) {
                if (cube.z < this.bounds.top && cube.top < this.bounds.top) {
                    //  cube fits into -x-y-z octant
                    index = 0;
                } else if (cube.z > this.bounds.top) {
                    //  cube fits into -x-y+z octant
                    index = 4;
                }
            } else if (cube.y > this.bounds.frontY) {
                if (cube.z < this.bounds.top && cube.top < this.bounds.top) {
                    //  cube fits into -x+y-z octant
                    index = 2;
                } else if (cube.z > this.bounds.top) {
                    //  cube fits into -x+y+z octant
                    index = 6;
                }
            }
        } else if (cube.x > this.bounds.frontX) {
            if (cube.y < this.bounds.frontY && cube.frontY < this.bounds.frontY) {
                if (cube.z < this.bounds.top && cube.top < this.bounds.top) {
                    //  cube fits into +x-y-z octant
                    index = 1;
                } else if (cube.z > this.bounds.top) {
                    //  cube fits into +x-y+z octant
                    index = 5;
                }
            } else if (cube.y > this.bounds.frontY) {
                if (cube.z < this.bounds.top && cube.top < this.bounds.top) {
                    //  cube fits into +x+y-z octant
                    index = 3;
                } else if (cube.z > this.bounds.top) {
                    //  cube fits into +x+y+z octant
                    index = 7;
                }
            }
        }


        return index;

    }

    /**
     * Return all objects that could collide with the given IsoSprite or Cube.
     *
     * @method Octree#retrieve
     * @param {IsoSprite|Cube} source - The source object to check the Octree against. Either a IsoSprite or Cube.
     * @return {array} - Array with all detected objects.
     */
    retrieve(source) {
        let returnObjects;
        let index;

        if (source instanceof Cube) {
            returnObjects = this.objects;

            index = this.getIndex(source);
        } else {
            if (!source.body) {
                return this._empty;
            }

            returnObjects = this.objects;

            index = this.getIndex(source.body);
        }

        if (this.nodes[0]) {
            //  If cube fits into a subnode ..
            if (index !== -1) {
                returnObjects = returnObjects.concat(this.nodes[index].retrieve(source));
            } else {
                //  If cube does not fit into a subnode, check it against all subnodes (unrolled for speed)
                returnObjects = returnObjects.concat(this.nodes[0].retrieve(source));
                returnObjects = returnObjects.concat(this.nodes[1].retrieve(source));
                returnObjects = returnObjects.concat(this.nodes[2].retrieve(source));
                returnObjects = returnObjects.concat(this.nodes[3].retrieve(source));
                returnObjects = returnObjects.concat(this.nodes[4].retrieve(source));
                returnObjects = returnObjects.concat(this.nodes[5].retrieve(source));
                returnObjects = returnObjects.concat(this.nodes[6].retrieve(source));
                returnObjects = returnObjects.concat(this.nodes[7].retrieve(source));
            }
        }

        return returnObjects;
    }

    /**
     * Clear the octree.
     * @method Octree#clear
     */
    clear() {

        this.objects.length = 0;

        let i = this.nodes.length;

        while (i--) {
            this.nodes[i].clear();
            this.nodes.splice(i, 1);
        }

        this.nodes.length = 0;
    }
}
