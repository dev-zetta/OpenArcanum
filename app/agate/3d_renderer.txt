/* global requireNode */
import BABYLON from './libs/babylonjs'

class Renderer {

    constructor(engine) {
        this.engine_ = new BABYLON.Engine(engine.canvas, true);

        // This creates a basic Babylon Scene object (non-mesh)
        this.scene_ = new BABYLON.Scene(this.engine_);

        // This creates and positions a free camera (non-mesh)
        var camera = new BABYLON.ArcRotateCamera("Camera", 1, 0.8, 8, new BABYLON.Vector3(0, 0, 0), this.scene_);
        //var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), this.scene_);

        // This targets the camera to scene origin
        camera.setTarget(BABYLON.Vector3.Zero());

        // This attaches the camera to the canvas
        camera.attachControl(engine.canvas, true);

        var spriteManagerTrees = new BABYLON.SpriteManager("treesManager", "textures/palm.png", 2000, 800, this.scene_);

        //We create 2000 trees at random positions
        for (var i = 0; i < 2000; i++) {
            var tree = new BABYLON.Sprite("tree", spriteManagerTrees);
            tree.position.x = Math.random() * 100 - 50;
            tree.position.z = Math.random() * 100 - 50;
            tree.isPickable = true;

            //Some "dead" trees
            if (Math.round(Math.random() * 5) === 0) {
                tree.angle = Math.PI * 90 / 180;
                tree.position.y = -0.3;
            }
        }

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene_);

        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 0.7;

        // Our built-in 'sphere' shape. Params: name, subdivs, size, scene
        var sphere = BABYLON.Mesh.CreateSphere("sphere1", 16, 2, this.scene_);

        // Move the sphere upward 1/2 its height
        sphere.position.y = 1;

        // Our built-in 'ground' shape. Params: name, width, depth, subdivs, scene
        var ground = BABYLON.Mesh.CreateGround("ground1", 6, 6, 2, this.scene_);

        // Resize
        /*engine.canvas.addEventListener("resize", function () {
            this.scene.resize();
        });*/

        this.engine_.runRenderLoop(() => {
            this.scene_.render()
        })


        return true;
    }
}

export default Renderer
