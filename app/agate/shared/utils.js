/* global requireNode */

const console = requireNode('console')
const process = requireNode('process')
const loadJsonFile = requireNode('load-json-file')
const find = requireNode('find')
const fs = requireNode('fs')
//const utils = requireNode('utils')._;
//const underscore = requireNode('underscore')._
const lodash = requireNode('lodash');


var myConsole = new console.Console(process.stdout, process.stderr)

// https://lodash.com/docs/4.17.4

class Utils extends lodash {
    static
    isFileExist(path) {
        return fs.existsSync(path)
    }

    static
    getLastDir(path) {
        return path.substring(path.lastIndexOf('/') + 1)
    }

    static
    logError() {
        myConsole.log('AGate: ', ...arguments)
    }

    static
    findFiles(dir, ext, callback) {
        let regExp = new RegExp(`\.${ext}`, 'i')

        if (Utils.isFunction(callback)) {
            return find.eachfile(regExp, dir, callback)
        } else {
            return find.fileSync(regExp, dir)
        }
    }

    static
    findDirs(dir, pattern, callback) {
        if (Utils.isFunction(callback)) {
            return find.eachdir(pattern, dir, callback)
        } else {
            return find.dirSync(pattern, dir)
        }
    }

    static
    loadJson(filePath, onLoad) {
        if (Utils.isFunction(onLoad)) {
            return loadJsonFile(filePath).then(onLoad)
        } else {
            return loadJsonFile.sync(filePath)
        }

    }
}

export default Utils
