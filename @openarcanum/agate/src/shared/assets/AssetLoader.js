// @flow
/* global createImageBitmap */
//var liquidfun = requireNode('liquidfun')

const fs = require(`fs`)
const path = require('node:path')
const util = require(`util`)
const mime = require(`mime-types`)
const find = require(`find`)
const StreamZip = require(`node-stream-zip`) // https://github.com/antelle/node-stream-zip

import Utils from '../misc/Utils';

export default class AssetLoader {
  loadedAssets: Map<string, Object>
  preloadAssets: Array<Object>
  useBlobs: boolean
  archives: Array<Object>
  archiveEntries: Map<string, Object>
  queueRunning: boolean

  constructor() {
    //this.engine = engine
    this.loadedAssets = new Map()
    this.preloadAssets = []

    this.useBlobs = false
    this.archives = []
    this.queueRunning = false
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
   * @param key
   * @returns {boolean}
   */
  getCachedAsset(key: string): Object {
    return this.loadedAssets.get(key)
  }

  /**
   *
   * @param descriptor
   */
  addToQueue(descriptor: Object, target: Object) {
    //if (this.loadedAssets.has(descriptor.key)) {
    //  this.notityTarget(descriptor, target)
    //  return
    //}

    /*(let entries = this.preloadAssets.get(descriptor.key)
    if (!entries) {
      entries = []
      this.preloadAssets.set(descriptor.key, entries)
    }*/

    this.preloadAssets.push({ descriptor, target })
    //this.loadedAssets.set(descriptor.key, null)
    this.startQueue()
  }

  /**
   *
   */
   startQueue() {

    if (this.queueRunning || this.preloadAssets.length === 0) {
      return
    }

     this.queueRunning = true


    let length = this.preloadAssets.length
     //if (length > 1000) {
     //  length = 1000
     //}

     let queue = this.preloadAssets.splice(0, length)

     lll(`Starting queue`, length)

     let loadedAssets = {}
     let loadPromises = []
    for (let item of queue) {
      let { descriptor, target } = item


      let { key } = descriptor

      if (this.loadedAssets.has(key)) {
        // asset with key already loaded
        //lll('already loaded', key)
        this.notityTarget(descriptor, target)
        continue
      }


      if (!loadedAssets[key]) {
        loadedAssets[key] = []
        loadPromises.push(this.loadAssetDirect(descriptor))
      }

      loadedAssets[key].push(item)
    }

    Promise.all(loadPromises).then((assetsList) => {
      //lll(`assets, `, assetsList)
      let total = 0
      for (let asset of assetsList) {
        let { key } = asset
        this.loadedAssets.set(key, asset)

        let items = loadedAssets[key]
        let item = items.shift()
        this.notityTarget(item.descriptor, item.target, true)

        for (let item of items) {
          this.notityTarget(item.descriptor, item.target)
        }
        total++
      }

      lll(`Total resources loaded`, total)

      setTimeout(() => {
        this.queueRunning = false
        this.startQueue()
      }, 100)

    })


  }

  /**
   *
   * @param file
   * @param zipId
   * @returns {Promise<void>}
   */
  async processArchive(file: string, zipId: number) {
    return new Promise((resolve) => {
      lll(`Loading archive: ${file}`)

      let zip = new StreamZip({
        file: file,
        storeEntries: false,
        skipEntryNameValidation: true
      })

      zip.on(`entry`, (entry) => {
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

      zip.on(`error`, (err) => {
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
    /*if (!list) {
      list = this.preloadAssets
    }*/

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

      /*if (loaded === list.length) {
        this.preloadAssets = []
      }*/
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
  async loadFile(src: string, encoding: string = ``): Promise<*> {
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
    if (!data) {
      return new Blob()
    }

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
      lle(`Unable to load file ${src}`)
      return ``
    }

    return util.format(
      `data:%s;base64,%s`,
      mime.lookup(src),
      data.toString(`binary`)
    )
  }

  /**
   *
   * @param src
   * @param callback
   * @returns {Promise<*>}
   */
  async createAndLoadImage(src: string, callback: ?Function = null) {
    if (Utils.isUndefined(createImageBitmap)) {
      let image = new Image()

      //image.crossOrigin = true
      if (this.useBlobs) {
        //$FlowFixMe
        image.src = this.loadFileToBlobUrl(src)

        image.onload = () => {
          URL.revokeObjectURL(image.src)

          if (callback){
            callback(false, image)
          }

        }

        image.onerror = () => {
          URL.revokeObjectURL(image.src)

          if (callback){
            callback(true, image)
          }

        }
      } else {
        //$FlowFixMe
        image.src = this.loadFileToDataUrl(src)

        image.onload = () => {
          if (callback){
            callback(false, image)
          }

        }

        image.onerror = () => {
          if (callback){
            callback(true, image)
          }

        }
      }

      return image
    } else {
      //console.log(`Fast loading...`)
      let blob = await this.loadFileToBlob(src)
      if (!blob) {
        lle(`Unable to load image: ${src}`)
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
    return new Promise((resolve) => {
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
    return new Promise((resolve) => {
      fs.writeFile(path, data, `utf8`, (err, data) => {
        resolve(data)
      })
    })
  }

  /**
   *
   * @param filePath
   * @returns {Promise<?string>}
   */
  async loadJsonFile(filePath: string): ?string {
    try {
      let data = await this.loadFile(filePath)
      if (!data) {
        return null
      }

      return JSON.parse(data.toString('utf8').replace(/^\uFEFF/, ''))
    } catch (err) {
      lle(filePath, err)
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
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
      await fs.promises.writeFile(filePath, `${JSON.stringify(object, null, 2)}\n`, 'utf8')
    } catch (err) {
      lle(err.message)
      return null
    }
  }

  /**
   *
   * @param descriptor
   * @param target
   * @param firstTime
   */
  notityTarget(descriptor, target, firstTime) {
    if (target) {
      target.onResourceLoaded(descriptor, firstTime)
    }

  }

  /**
   *
   * @param descriptor
   * @param target
   * @returns {Promise<Object>}
   */
  async loadAsset(descriptor: Object, target: ?Object): Promise<Object> {
    let cached = this.getCachedAsset(descriptor.key)
    if (cached != null) {
      console.log(`Already loaded: ${descriptor.key}`)
      Object.assign(descriptor, cached)

      this.notityTarget(descriptor, target)
      return descriptor
    }

    if (target) {
      this.addToQueue(descriptor, target)
      return
    }

    descriptor = await this.loadAssetDirect(descriptor)

    this.loadedAssets.set(descriptor.key, descriptor)

    return descriptor
  }

  /**
   *
   * @param descriptor
   * @returns {Promise<*>}
   */
  async loadAssetDirect(descriptor: Object): Promise<Object> {

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
          return null
        }

        descriptor.meta = await this.loadJsonFile(descriptor.data)

        if (Utils.isUndefined(descriptor.meta)) {
          Utils.logError(`Unable to load file: ${descriptor.data}`)
          return null
        }

        break
      case `json`:
        descriptor.meta = await this.loadJsonFile(descriptor.data)
        break
      case `shader`:
        console.log(`shader`, descriptor.fragment)

        descriptor.fragment = await this.loadTextFile(descriptor.fragment)
        descriptor.vertex = await this.loadTextFile(descriptor.vertex)
        break
    }

    return descriptor
  }

  /**
   *
   * @param dir
   * @param ext
   * @returns {Promise<void>}
   */
  async findFiles(dir: string, ext: string) {
    let regExp = new RegExp(`\.${ext}`, `i`)
    return new Promise((resolve) => {
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
  async findDirs(dir: string, pattern: ?RegExp) {
    return new Promise((resolve) => {
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
  findInArchives(what: string, filter: ?RegExp = null): ?Object {
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
