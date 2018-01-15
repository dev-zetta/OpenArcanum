import { Projector } from './Projector';
import { IsoPhysics } from './IsoPhysics';

/**
* The MIT License (MIT)

* Copyright (c) 2015 Lewis Lane

* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*
*
*
*/

/**
 * @author       Lewis Lane <lew@rotates.org>
 * @copyright    2015 Lewis Lane (Rotates.org)
 * @license      {@link http://opensource.org/licenses/MIT|MIT License}
 */

/**
 * @class Phaser.Plugin.Isometric
 *
 * @classdesc
 * Isometric is a comprehensive axonometric plugin for Phaser which provides an API for handling axonometric projection of assets in 3D space to the screen.
 * The goal has been to mimic as closely as possible the existing APIs provided by Phaser for standard orthogonal 2D projection, but add a third dimension.
 * Also included is an Arcade-based 3D AABB physics engine, which again is closely equivalent in functionality and its API.
 *
 * @constructor
 * @param {Phaser.Game} game The current game instance.
 * @param {number} isometricType - the isometric projection angle to use.
 */
export class Isometric {
    constructor(scene, parent, isometricType = Isometric.ISOMETRIC) {
        this.scene = scene;
        this.scene.physics.system = new IsoPhysics(this.scene.physics);

        this.projector = new Projector(this.scene, isometricType);
        //  Add an instance of Isometric.Projector to scene.iso if it doesn't exist already
        this.scene.iso = this.scene.iso || this.projector;
    }
}

Isometric.VERSION = '0.9.3';

//  Directional consts
Isometric.UP = 0;
Isometric.DOWN = 1;
Isometric.FORWARDX = 2;
Isometric.FORWARDY = 3;
Isometric.BACKWARDX = 4;
Isometric.BACKWARDY = 5;

//  Type consts
Isometric.ISOSPRITE = 'isosprite';
Isometric.ISOARCADE = 'isoarcade';


//  Projection angles
Isometric.CLASSIC = Math.atan(0.5);
Isometric.ISOMETRIC = Math.PI / 6;
Isometric.MILITARY = Math.PI / 4;
