/* global requireNode */

//import Engine from './shared/engine'
import { Utils } from './shared/Utils'

class AGate {
    static getDataPath(subDir = '') {
        return `/media/maxli/Data/dev/ArcanumAlive/Data/converted/${subDir}`
    }

    static getDataUrl(subDir = '') {
        return `http://localhost:7000/${subDir}`
    }

    static requireNode(name) {
        return requireNode(name)
    }

}

AGate.Enum = requireNode('enum')
//AGate.Engine = Engine
AGate.Utils = Utils

AGate.Const = {
    Sprite: {
        'DefaultExt': 'gif'
    }

}

export default AGate
