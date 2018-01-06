import AGate from '../agate'
import {GfxTypes, GfxPathBuilder} from '../shared/assets'
import Enums from '../shared/enums'

import Phaser from './phaser'

export default class Sprite {

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
        } else {
            path = data
        }

        this.path = path

        this.variants = []

        let meta = AGate.Utils.loadJson(`${dataPath}/${this.path}/Meta.json`)
        Object.assign(this, meta);
        /*
        "frameRate": 14,
        "stageCount": 8,
        "stageLength": 10,
        "triggerFrame": 7,
        "versionCount": 4
        */

        let variant = 0 //AGate.Utils.isUndefined(data.variant) ? 0 : data.variant
        this.stages = []

        let stageDirs = AGate.Utils.findDirs(`${dataPath}/${this.path}/${variant}/`)

        let self = this
        stageDirs.forEach(function(dir) {
            let stageName = AGate.Utils.getLastDir(dir)
            let path = `${self.path}/${variant}/${stageName}`

            //AGate.Utils.logError(AGate.Utils.isFileExist(`${dir}/Sprite.${AGate.Const.Sprite.DefaultExt}`))

            let urlPath = `${dataUrl}/${path}`
            //if (AGate.Utils.isFileExist(`${urlPath}/Stage.json`))

            self.client.scene.loadAsset(path, 'atlas', {texture: `${urlPath}/Sprite.${AGate.Const.Sprite.DefaultExt}`, data: `${urlPath}/Stage.json`})

            self.stages.push(stageName)
        })

        this.selectedVariant = variant
        this.currentStage = AGate.Utils.isUndefined(data.stage) ? 'North' : data.stage
    }

    addToScene(target, x, y) {
        var currentStagePath = `${this.path}/${this.selectedVariant}/${this.currentStage}`

        this.sprite = target.create(x, y, currentStagePath, `${currentStagePath}/${this.frame}`)
        //this.sprite.frameName =
        this.sprite.checkWorldBounds = false
        this.sprite.autoCull = true
        this.sprite.flipX = this.flipped

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
