import AGate from '../agate'
import {GfxTypes, GfxPathBuilder} from '../shared/assets'
import Enums from '../shared/enums'

import Phaser from '../libs/phaser'

export class Sprite {

    constructor(client) {
        this.client = client
    }

    load(data) {
        var dataUrl = AGate.getDataUrl('Gfx/2D')
        var dataPath = AGate.getDataPath('Gfx/2D')

        var path = ''
        if (AGate.Utils.isObject(data)) {
            let builder = new GfxPathBuilder(data)
            path = builder.toPath()

            this.flipped = data.flipped
            this.frame = AGate.Utils.isUndefined(data.frame) ? 0 : data.frame
            this.type = data.type
        } else {
            path = data
        }

        this.path = path

        let variant = 0 //AGate.Utils.isUndefined(data.variant) ? 0 : data.variant

        this.selectedVariant = variant
        this.currentStage = AGate.Utils.isUndefined(data.stage) ? 'North' : data.stage

        if (this.type == 'Tile') {

            return
        }

        let meta = AGate.Utils.loadJson(`${dataPath}/${this.path}/Meta.json`)
        Object.assign(this, meta);

        /*
        "frameRate": 14,
        "stageCount": 8,
        "stageLength": 10,
        "triggerFrame": 7,
        "versionCount": 4
        */

        /*if (AGate.Utils.isNumber(this.currentStage)) {
            this.currentStage = 'North'; // HACK
        }*/

        this.variants = []
        this.stages = []

        let stageDirs = AGate.Utils.findDirs(`${dataPath}/${this.path}/${variant}/`)

        let self = this
        stageDirs.forEach(function(dir) {
            let stageName = AGate.Utils.getLastDir(dir)
            let path = `${self.path}/${variant}/${stageName}`

            //AGate.Utils.logError(`${dir}/Sprite.${AGate.Const.Sprite.DefaultExt}`)

            let urlPath = `${dataUrl}/${path}`
            //if (AGate.Utils.isFileExist(`${urlPath}/Stage.json`))

            self.client.scene.loadAsset(path, 'atlas', {texture: `${urlPath}/Sprite.${AGate.Const.Sprite.DefaultExt}`, data: `${urlPath}/Stage.json`})

            self.stages.push(stageName)
        })
    }

    addToScene(target, x, y, z = 0) {
        var currentPath = `${this.path}/${this.selectedVariant}`
        var key, frame

        switch (this.type) {
            case 'Tile':
                key = 'tiles'
                frame = `${currentPath}/${this.currentStage}/Sprite.gif`
                break;
            case 'Wall':
            case 'Portal':
                key = `${currentPath}/North`
                frame = `${key}/${this.frame}`
                break;
            default:
                key = `${currentPath}/${this.currentStage}`
                frame = `${key}/${this.frame}`
                break;
        }

        this.sprite = target.scene.addIsoSprite(x, y, z, key, frame, target); // target.create(x, y, currentStagePath, `${currentStagePath}/${this.frame}`)

        //this.sprite.frameName =
        this.sprite.checkWorldBounds = false
        this.sprite.autoCull = true
        this.sprite.setInteractive();

        if (this.flipped) {
            this.sprite.originX = 0.5
            this.sprite.originY = 0.5
            this.sprite.scaleX *= -1
        }


        //this.sprite.flipX = this.flipped

        //if (this.sprite.flipY)
        //AGate.Utils.logError(this.sprite.frameName)

        /*for (let stageIndex = 0; stageIndex < this.stages.length; stageIndex++) {
            let stageName = this.stages[stageIndex]
            let stagePath = `${this.path}/${this.selectedVariant}/${stageName}`

            // create animation
            let frames = this.client.scene.anims.generateFrameNames(stagePath, { prefix: `${stagePath}/`, end: this.stageLength - 1 })
            this.client.scene.anims.create({ key: stagePath, frames: frames, repeat: -1 })

            // load animation
            this.sprite.anims.load(stagePath)
        }*/

    }



}
