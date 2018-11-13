/* global AGate, requireNode */
//var liquidfun = requireNode('liquidfun')

import {GfxPathBuilder} from './GfxPathBuilder'

const fs = AGate.requireNode(`fs`)
const util = AGate.requireNode(`util`)
const mime = AGate.requireNode(`mime-types`)
const parseJson = AGate.requireNode(`parse-json`)
const writeJsonFile = AGate.requireNode(`write-json-file`)
const find = AGate.requireNode(`find`)

// https://github.com/antelle/node-stream-zip

const StreamZip = AGate.requireNode(`node-stream-zip`)

export class AssetLoader {
  /**
   *
   * @param engine
   */
  constructor(engine) {
    this.engine = engine
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
  hasAsset(key) {
    return this.loadedAssets.has(key)
  }

  /**
   *
   * @param descriptor
   */
  preload(descriptor) {
    if (this.loadedAssets.has(descriptor.key)) {
      return
    }

    this.preloadAssets.push(descriptor)
    this.loadedAssets.set(descriptor.key, null)
  }

  /**
   *
   * @param file
   * @param zipId
   * @returns {Promise<void>}
   */
  async processArchive(file, zipId) {
    return new Promise(resolve => {
      console.log(`Loading archive: ${file}`)

      let zip = new StreamZip({
        file: file,
        storeEntries: false
      })

      zip.on(`entry`, entry => {
        if (entry.isDirectory) return

        //console.log(`Read entry ${entry.name}`);

        let parts = entry.name.split(`/`)
        let parent = this.archiveEntries

        for (let i = 0; i < parts.length; i++) {
          let part = parts[i]

          if (i + 1 == parts.length) {
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
  async loadAssets(list, onLoaded) {
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
        this.preloadAssets.clear()
      }
    }

    return true
  }

  /**
   *
   * @param string
   * @param contentType
   * @param sliceSize
   * @returns {Blob}
   */
  stringToBlob(string, contentType = ``, sliceSize = 512) {
    const byteCharacters = string
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

  async loadFileFromDisk(src, encoding) {
    return new Promise((resolve, reject) => {
      fs.readFile(src, encoding, (err, data) => {
        resolve(data)
      })
    })
  }

  isFileExists(src) {
    return fs.existsSync(src)
  }

  /**
   *
   * @param src
   * @param encoding
   */
  async loadFile(src, encoding = undefined) {
    // Does the file exists on disk?
    if (AGate.Utils.isArray(src)) {
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
  async loadFileToBlob(src) {
    let data = await this.loadFile(src)
    if (!data) return null

    let blob = this.stringToBlob(data.toString(`binary`))
    return blob
  }

  /**
   *
   * @param src
   * @returns {Promise<string>}
   */
  async loadFileToBlobUrl(src) {
    //var data = fs.readFileSync(src).toString("base64")
    //return util.format("data:%s;base64,%s", mime.lookup(src), data)

    let blob = await this.loadFileToBlob(src)
    return URL.createObjectURL(blob)
  }

  /**
   *
   * @param src
   * @returns {Promise<void>}
   */
  async loadFileToDataUrl(src) {
    let data = await this.loadFile(src, `base64`)
    if (!data) {
      AGate.Utils.logError(`Unable to load file ${src}`)
      return null
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
   * @returns {Promise<any>}
   */
  async createAndLoadImage(src) {
    if (AGate.Utils.isUndefined(createImageBitmap)) {
      let image = new Image()

      //image.crossOrigin = true
      if (this.useBlobs) {
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
      console.log(`Fast loading...`)
      let blob = await this.loadFileToBlob(src)
      if (!blob) {
        AGate.Utils.logError(`Unable to load image: ${src}`)
        return new Image()
      }

      return await createImageBitmap(blob)
    }
  }

  /**
   *
   * @param path
   * @returns {Promise<void>}
   */
  async loadTextFile(path) {
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
  async saveTextFile(path, data) {
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
  async loadJsonFile(filePath) {
    try {
      let data = await this.loadFile(filePath)

      return parseJson(data.toString(`binary`))
    } catch (err) {
      AGate.Utils.logError(err.message)
      return null
    }
  }

  /**
   *
   * @param filePath
   * @param object
   * @returns {Promise<*>}
   */
  async saveJsonFile(filePath, object) {
    try {
      return await writeJsonFile(filePath, object)
    } catch (err) {
      AGate.Utils.logError(err.message)
      return null
    }
  }

  /**
   *
   * @param descriptor
   * @returns {Promise<boolean>}
   */
  async loadAsset(descriptor) {
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
          AGate.Utils.logError(`Unable to load file: ${descriptor.texture}`)
          return false //Promise.resolve(false);
        }

        descriptor.meta = await this.loadJsonFile(descriptor.data)

        if (AGate.Utils.isUndefined(descriptor.meta)) {
          AGate.Utils.logError(`Unable to load file: ${descriptor.data}`)
          return false //Promise.resolve(false);
        }

        break
      case `json`:
        descriptor.meta = await this.loadJsonFile(descriptor.data)
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
  async findFiles(dir, ext) {
    let regExp = new RegExp(`\.${ext}`, `i`)
    return new Promise(resolve => {
      let entries = this.findInArchives(dir, regExp)
      if (entries) {
        resolve(entries)
        return
      }

      let list = find.fileSync(regExp, dir)
      resolve(list)
    })
  }

  /**
   *
   * @param dir
   * @param pattern
   * @returns {Promise<void>}
   */
  async findDirs(dir, pattern) {
    return new Promise(resolve => {
      if (!pattern) {
        pattern = new RegExp(`^[^.]+$`, `i`)
      }

      let entries = this.findInArchives(dir, pattern)
      if (entries) {
        resolve(entries)
        return
      }

      let list = find.dirSync(pattern, dir)
      resolve(list)
    })
  }

  /**
   *
   * @param what
   * @param filter
   * @returns {*}
   */
  findInArchives(what, filter = null) {
    if (!this.archiveEntries) {
      return null
    }

    let parts = what.split(`/`)

    let partsCount = parts.length
    if (what.endsWith(`/`)) {
      partsCount -= 1
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

export {GfxPathBuilder}
