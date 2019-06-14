//@flow
/* global createImageBitmap */
//var liquidfun = requireNode('liquidfun')

const fs = require(`fs`)
const util = require(`util`)
const mime = require(`mime-types`)
const parseJson = require(`parse-json`)
const writeJsonFile = require(`write-json-file`)
const find = require(`find`)

// https://github.com/antelle/node-stream-zip
const StreamZip = require(`node-stream-zip`)

import GfxPathBuilder from './GfxPathBuilder'
import Utils from '../misc/Utils'

export default class AssetLoader {
  loadedAssets: Map<string, Object>
  preloadAssets: Array<Object>
  useBlobs: boolean
  archives: Array<Object>
  archiveEntries: Map<string, Object>

  /**
   *
   * @param engine
   */
  constructor() {
    //this.engine = engine
    this.loadedAssets = new Map()
    this.preloadAssets = []

    this.useBlobs = false
    this.archives = []
  }

  /**
   *
   * @param key
   * @returns {boolean}
   */
  hasAsset(key: string): boolean {
    return this.loadedAssets.has(key)
  }

  /**
   *
   * @param descriptor
   */
  preload(descriptor: Object) {
    if (this.loadedAssets.has(descriptor.key)) {
      return
    }

    this.preloadAssets.push(descriptor)
    this.loadedAssets.set(descriptor.key, null)
  }

  /**
   *
   * @param options
   * @returns {string}
   */
  buildPath(options: Object): string {
    let builder = new GfxPathBuilder(options)
    return builder.toPath()
  }

  /**
   *
   * @param file
   * @param zipId
   * @returns {Promise<void>}
   */
  async processArchive(file: string, zipId: number) {
    return new Promise(resolve => {
      console.log(`Loading archive: ${file}`)

      let zip = new StreamZip({
        file: file,
        storeEntries: false,
        skipEntryNameValidation: true
      })

      zip.on(`entry`, entry => {
        if (entry.isDirectory) {return}

        //console.log(`Read entry ${entry.name}`);

        let parts = entry.name.split(`/`)
        let parent = this.archiveEntries

        for (let i = 0; i < parts.length; i++) {
          let part = parts[i]

          if (i + 1 === parts.length) {
            if (parent.has(part)) {
              console.log(`Overriding file? ${entry.name}`)
            }

            entry.zipId = zipId
            parent.set(part, entry)
          } else {
            let child = parent.get(part)
            if (!child) {
              child = new Map()
              parent.set(part, child)
            }

            parent = child
          }
        }
      })

      zip.on(`error`, err => {
        console.log(err)
      })

      zip.on(`ready`, () => {
        resolve(zip)
      })
    })
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    let path = AGate.getAppPath(`archives/`)

    let files = await this.findFiles(path, `.zip`)

    this.archiveEntries = new Map()

    for (let i = 0; i < files.length; i++) {
      let file = files[i]

      let zipId = this.archives.length
      let zip = await this.processArchive(file, zipId)
      this.archives.push(zip)
    }
  }

  /**
   *
   * @param list
   * @param onLoaded
   * @returns {Promise<boolean>}
   */
  async loadAssets(list: Array<Object>, onLoaded: function) {
    if (!list) {
      list = this.preloadAssets
    }

    let loaded = 0
    for (let i = 0; i < list.length; i++) {
      let descriptor = list[i]

      if (descriptor == null) {
        continue
      }

      let result = await this.loadAsset(descriptor)
      if (result) {
        onLoaded(descriptor)
      }

      loaded += 1

      list[i] = null

      if (loaded === list.length) {
        this.preloadAssets = []
      }
    }

    return true
  }

  /**
   *
   * @param str
   * @param contentType
   * @param sliceSize
   * @returns {Blob}
   */
  stringToBlob(str: string, contentType: string = ``, sliceSize: number = 512) {
    const byteCharacters = str
    const byteArrays = []

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize)
      const byteNumbers = new Array(slice.length)

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i)
      }

      const byteArray = new Uint8Array(byteNumbers)
      byteArrays.push(byteArray)
    }

    const blob = new Blob(byteArrays, { type: contentType })
    return blob
  }

  /**
   *
   * @param src
   * @param encoding
   * @returns {Promise}
   */
  async loadFileFromDisk(src: string, encoding: string) {
    return new Promise((resolve, reject) => {
      fs.readFile(src, encoding, (err, data) => {
        resolve(data)
      })
    })
  }

  /**
   *
   * @param src
   * @returns {boolean}
   */
  isFileExists(src: string): boolean {
    return fs.existsSync(src)
  }

  /**
   *
   * @param src
   * @param encoding
   */
  async loadFile(src: string, encoding: string = ''): Promise<*> {
    // Does the file exists on disk?
    if (Utils.isArray(src)) {
      for (let filePath of src) {
        filePath = AGate.getAppPath(filePath)
        if (this.isFileExists(filePath)) {
          return this.loadFileFromDisk(filePath, encoding)
        }
      }
    } else {
      let filePath = AGate.getAppPath(src)
      if (this.isFileExists(filePath)) {
        return this.loadFileFromDisk(filePath, encoding)
      }
    }

    // No, then load from zip archives
    let result = this.findInArchives(src)

    if (result) {
      //console.log(`Loaded file from zip: ${src}`);

      try {
        let entry = result //[0];
        let archive = this.archives[entry.zipId]

        const data = archive.entryDataSync(entry)

        return data
      } catch (err) {
        console.log(err)
      }

      return null
    }

    /*let root = AGate.getAppPath()

      fs.readFile(`${root}/${src}`, encoding, (err, data) => {
        if (err) {
          AGate.Utils.logError(`Unable to load file: ${src}`)
          resolve(null)
        } else {
          resolve(data)
        }
      })*/

    return null
  }

  /**
   *
   * @param src
   * @returns {Promise<*>}
   */
  async loadFileToBlob(src: string): Promise<Blob> {
    let data = await this.loadFile(src)
    if (!data) {return new Blob}

    let blob = this.stringToBlob(data.toString(`binary`))
    return blob
  }

  /**
   *
   * @param src
   * @returns {Promise<string>}
   */
  async loadFileToBlobUrl(src: string): Promise<string> {
    //var data = fs.readFileSync(src).toString("base64")
    //return util.format("data:%s;base64,%s", mime.lookup(src), data)

    let blob: Blob = await this.loadFileToBlob(src)
    return URL.createObjectURL(blob)
  }

  /**
   *
   * @param src
   * @returns {Promise<void>}
   */
  async loadFileToDataUrl(src: string): Promise<string> {
    let data = await this.loadFile(src, `base64`)
    if (!data) {
      Utils.logError(`Unable to load file ${src}`)
      return ''
    }

    let result = util.format(
      `data:%s;base64,%s`,
      mime.lookup(src),
      data.toString(`binary`)
    )
    return result
  }

  /**
   *
   * @param src
   * @param callback
   * @returns {Promise<*>}
   */
  async createAndLoadImage(src: string, callback: ?function = null) {
    if (Utils.isUndefined(createImageBitmap)) {
      let image = new Image()

      //image.crossOrigin = true
      if (this.useBlobs) {
        //$FlowFixMe
        image.src = this.loadFileToBlobUrl(src)

        image.onload = () => {
          URL.revokeObjectURL(image.src)

          callback(false, image)
        }

        image.onerror = () => {
          URL.revokeObjectURL(image.src)

          callback(true, image)
        }
      } else {
        //$FlowFixMe
        image.src = this.loadFileToDataUrl(src)

        image.onload = () => {
          callback(false, image)
        }

        image.onerror = () => {
          callback(true, image)
        }
      }

      return image
    } else {
      //console.log(`Fast loading...`)
      let blob = await this.loadFileToBlob(src)
      if (!blob) {
        Utils.logError(`Unable to load image: ${src}`)
        return new Image()
      }

      return createImageBitmap(blob)
    }
  }

  /**
   *
   * @param path
   * @returns {Promise<void>}
   */
  async loadTextFile(path: string): Promise<string> {
    return new Promise(resolve => {
      fs.readFile(path, `utf8`, (err, data) => {
        resolve(data)
      })
    })
  }

  /**
   *
   * @param path
   * @param data
   * @returns {Promise<void>}
   */
  async saveTextFile(path: string, data: string) {
    return new Promise(resolve => {
      fs.writeFile(path, data, `utf8`, (err, data) => {
        resolve(data)
      })
    })
  }

  /**
   *
   * @param filePath
   * @returns {Promise<*>}
   */
  async loadJsonFile(filePath: string) {
    try {
      let data = await this.loadFile(filePath)
      if (!data) {
        return null
      }

      return parseJson(data.toString(`binary`))
    } catch (err) {
      Utils.logError(filePath, err)
      return null
    }
  }

  /**
   *
   * @param filePath
   * @param object
   * @returns {Promise<*>}
   */
  async saveJsonFile(filePath: string, object: Object) {
    try {
      return await writeJsonFile(filePath, object, {indent: 2})
    } catch (err) {
      Utils.logError(err.message)
      return null
    }
  }

  /**
   *
   * @param descriptor
   * @returns {Promise<boolean>}
   */
  async loadAsset(descriptor: Object) {
    if (this.loadedAssets.get(descriptor.key) != null) {
      console.log(`Already loaded: ${descriptor.key}`)
      return false
    }

    let result

    switch (descriptor.type) {
      case `atlas`:
        switch (descriptor.output) {
          case `base64`:
            descriptor.image = await this.loadFileToDataUrl(descriptor.texture)
            break
          default:
            descriptor.image = await this.createAndLoadImage(descriptor.texture)
            break
        }

        if (!descriptor.image) {
          Utils.logError(`Unable to load file: ${descriptor.texture}`)
          return false //Promise.resolve(false);
        }

        descriptor.meta = await this.loadJsonFile(descriptor.data)

        if (Utils.isUndefined(descriptor.meta)) {
          Utils.logError(`Unable to load file: ${descriptor.data}`)
          return false //Promise.resolve(false);
        }

        break
      case `json`:
        descriptor.meta = await this.loadJsonFile(descriptor.data)
        break
      case `shader`:
        console.log('shader', descriptor.fragment)

        descriptor.fragment = await this.loadTextFile(descriptor.fragment)
        descriptor.vertex = await this.loadTextFile(descriptor.vertex)
        break
    }

    //console.log(descriptor.key);
    this.loadedAssets.set(descriptor.key, descriptor)
    return true //Promise.resolve(true);
  }

  /**
   *
   * @param dir
   * @param ext
   * @returns {Promise<void>}
   */
  async findFiles(dir: string, ext: string) {
    let regExp = new RegExp(`\.${ext}`, `i`)
    return new Promise(resolve => {
      let entries = this.findInArchives(dir, regExp)
      if (entries) {
        resolve(entries)
        return
      }

      let path = AGate.getAppPath(dir)
      let list = find.fileSync(regExp, path)
      /*for (let i = 0; i < list.length; i++) {
        list[i] = list[i].substring(path.length)
      }*/

      resolve(list)
    })
  }

  /**
   *
   * @param dir
   * @param pattern
   * @returns {Promise<void>}
   */
  async findDirs(dir: string, pattern: RegExp) {
    return new Promise(resolve => {
      if (!pattern) {
        pattern = new RegExp(`^[^.]+$`, `i`)
      }

      let entries = this.findInArchives(dir, pattern)
      if (entries) {
        resolve(entries)
        return
      }

      let path = AGate.getAppPath(dir)
      let list = find.dirSync(pattern, path)
      /*for (let i = 0; i < list.length; i++) {
        list[i] = list[i].substring(path.length)
      }*/

      resolve(list)
    })
  }

  /**
   *
   * @param what
   * @param filter
   * @returns {*}
   */
  findInArchives(what: string, filter: ?RegExp = null): Object {
    if (!this.archiveEntries) {
      return null
    }

    let parts = what.split(`/`) // split to folders and files

    let partsCount = parts.length
    if (what.endsWith(`/`)) {
      partsCount -= 1 // its a dir for sure
    }

    let parent = this.archiveEntries

    for (let i = 0; i < partsCount; i++) {
      let part = parts[i]

      let item = parent.get(part)
      if (!item) {
        console.log(`Not found: ${what} - ${part}`)
        return null
      }

      if (i + 1 === partsCount) {
        if (!filter) {
          return item
        }

        //console.log(what)
        let result = new Map()
        for (let [key, value] of item) {
          if (filter.exec(key)) {
            result.set(key, value)
          }
        }

        return result
      }

      parent = item
    }

    return null
  }
}
