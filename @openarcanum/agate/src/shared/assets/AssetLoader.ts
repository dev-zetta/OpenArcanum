/* global createImageBitmap */
//var liquidfun = requireNode('liquidfun')

import fs from 'node:fs'
import path from 'node:path'
import mime from 'mime-types'
import StreamZip from 'node-stream-zip'
interface Finder { fileSync(pattern: RegExp, directory: string): string[]; dirSync(pattern: RegExp, directory: string): string[] }
const find = require('find') as Finder
export interface AssetDescriptor {
  key: string
  type: string
  output?: string
  texture?: string
  data?: string
  image?: string | HTMLImageElement | ImageBitmap
  meta?: unknown
  fragment?: string
  vertex?: string
}
export interface AssetTarget { onResourceLoaded(descriptor: AssetDescriptor, firstTime?: boolean): unknown }
interface QueueItem { descriptor: AssetDescriptor; target?: AssetTarget | null }
export type ArchiveEntry = StreamZip.ZipEntry & { zipId: number }
export interface ArchiveDirectory extends Map<string, ArchiveEntry | ArchiveDirectory> {}

import Utils from '../misc/Utils';

export default class AssetLoader {
  declare pendingAssets: Map<string, Promise<AssetDescriptor>>

  declare loadedAssets: Map<string, AssetDescriptor>
  declare preloadAssets: QueueItem[]
  declare useBlobs: boolean
  declare archives: StreamZip[]
  declare archiveEntries: ArchiveDirectory
  declare queueRunning: boolean


  constructor() {
    //this.engine = engine
    this.loadedAssets = new Map()
    this.pendingAssets = new Map()
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
  getCachedAsset(key: string): AssetDescriptor | undefined {
    return this.loadedAssets.get(key)
  }

  /**
   *
   * @param descriptor
   */
  addToQueue(descriptor: AssetDescriptor, target?: AssetTarget | null) {
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

     let loadedAssets: Record<string, QueueItem[]> = {}
     let loadPromises: Promise<AssetDescriptor | null>[] = []
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
        if (!asset) continue
        let { key } = asset
        this.loadedAssets.set(key, asset)

        let items = loadedAssets[key]
        let item = items.shift()!
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
  async processArchive(file: string, zipId: number): Promise<StreamZip> {
    return new Promise<StreamZip>((resolve, reject) => {
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

            parent.set(part, Object.assign(entry, { zipId }))
          } else {
            let child = parent.get(part)
            if (!child) {
              child = new Map()
              parent.set(part, child)
            }

            parent = child as ArchiveDirectory
          }
        }
      })

      zip.on(`error`, (err) => {
        reject(err)
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
    if (this.archiveEntries) return
    let path = AGate.getAppPath(`archives/`)

    let files = await this.findFiles(path, `.zip`) as string[]

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
  async loadAssets(list: (AssetDescriptor | null)[], onLoaded: (descriptor: AssetDescriptor) => unknown) {
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
  async loadFileFromDisk(src: string, encoding: BufferEncoding | null): Promise<string | Buffer> {
    return new Promise<string | Buffer>((resolve, reject) => {
      fs.readFile(src, encoding || null, (err, data) => {
        if (err) return reject(err)
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
  async loadFile(src: string | string[], encoding: BufferEncoding | null = null): Promise<string | Buffer | null> {
    // Does the file exists on disk?
    if (Array.isArray(src)) {
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
    let result = this.findInArchives(Array.isArray(src) ? src[0] : src)

    if (result && !(result instanceof Map)) {
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
    const data = await this.loadFile(src)
    if (!data) throw new Error(`Missing image: ${src}`)
    return new Blob([new Uint8Array(typeof data === 'string' ? Buffer.from(data) : data)], { type: mime.lookup(src) || 'application/octet-stream' })
  }

  /**
   *
   * @param src
   * @returns {Promise<string>}
   */
  async loadFileToBlobUrl(src: string): Promise<string> {
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
  async loadFileToDataUrl(src: string): Promise<string> {
    const data = await this.loadFile(src)
    if (!data) throw new Error(`Missing image: ${src}`)
    return `data:${mime.lookup(src) || 'application/octet-stream'};base64,${Buffer.from(data).toString('base64')}`
  }

  /**
   *
   * @param src
   * @param callback
   * @returns {Promise<*>}
   */
  async createAndLoadImage(src: string, callback: ((error: false, image: HTMLImageElement | ImageBitmap) => unknown) | null = null) {
    let image
    if (typeof createImageBitmap === 'function') {
      image = await createImageBitmap(await this.loadFileToBlob(src))
    } else {
      image = new Image()
      image.src = await this.loadFileToDataUrl(src)
      await image.decode()
    }
    if (callback) callback(false, image)
    return image
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
      fs.writeFile(path, data, `utf8`, () => {
        resolve(undefined)
      })
    })
  }

  /**
   *
   * @param filePath
   * @returns {Promise<?string>}
   */
  async loadJsonFile(filePath: string): Promise<unknown> {
    try {
      let data = await this.loadFile(filePath)
      if (!data) {
        return null
      }

      return JSON.parse((typeof data === 'string' ? data : data.toString('utf8')).replace(/^\uFEFF/, ''))
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
  async saveJsonFile(filePath: string, object: Record<string, unknown>) {
    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
      await fs.promises.writeFile(filePath, `${JSON.stringify(object, null, 2)}\n`, 'utf8')
    } catch (err) {
      lle(err instanceof Error ? err.message : String(err))
      return null
    }
  }

  /**
   *
   * @param descriptor
   * @param target
   * @param firstTime
   */
  notityTarget(descriptor: AssetDescriptor, target?: AssetTarget | null, firstTime?: boolean) {
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
  async loadAsset(descriptor: AssetDescriptor, target?: AssetTarget | null): Promise<AssetDescriptor> {
    let cached = this.getCachedAsset(descriptor.key)
    if (cached != null) {
      console.log(`Already loaded: ${descriptor.key}`)
      Object.assign(descriptor, cached)

      this.notityTarget(descriptor, target)
      return descriptor
    }

    let pending = this.pendingAssets.get(descriptor.key)
    if (!pending) {
      pending = this.loadAssetDirect(descriptor).then(loaded => {
        if (!loaded) throw new Error(`Unable to load asset: ${descriptor.key}`)
        this.loadedAssets.set(descriptor.key, loaded)
        return loaded
      }).finally(() => this.pendingAssets.delete(descriptor.key))
      this.pendingAssets.set(descriptor.key, pending)
    }
    const loaded = await pending
    Object.assign(descriptor, loaded)
    this.notityTarget(descriptor, target, true)
    return descriptor
  }

  /**
   *
   * @param descriptor
   * @returns {Promise<*>}
   */
  async loadAssetDirect(descriptor: AssetDescriptor): Promise<AssetDescriptor | null> {

    switch (descriptor.type) {
      case `atlas`:
        switch (descriptor.output) {
          case `base64`:
            descriptor.image = await this.loadFileToDataUrl(descriptor.texture!)
            break
          default:
            descriptor.image = await this.createAndLoadImage(descriptor.texture!)
            break
        }

        if (!descriptor.image) {
          Utils.logError(`Unable to load file: ${descriptor.texture}`)
          return null
        }

        descriptor.meta = await this.loadJsonFile(descriptor.data!)

        if (!descriptor.meta) {
          Utils.logError(`Unable to load file: ${descriptor.data}`)
          return null
        }

        break
      case `json`:
        descriptor.meta = await this.loadJsonFile(descriptor.data!)
        break
      case `shader`:
        console.log(`shader`, descriptor.fragment)

        descriptor.fragment = await this.loadTextFile(descriptor.fragment!)
        descriptor.vertex = await this.loadTextFile(descriptor.vertex!)
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
  async findFiles(dir: string, ext: string): Promise<string[] | ArchiveDirectory> {
    let regExp = new RegExp(`\.${ext}`, `i`)
    return new Promise<string[] | ArchiveDirectory>((resolve) => {
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
  async findDirs(dir: string, pattern?: RegExp | null): Promise<string[] | ArchiveDirectory> {
    return new Promise<string[] | ArchiveDirectory>((resolve) => {
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
  findInArchives(what: string, filter: RegExp): ArchiveDirectory | null
  findInArchives(what: string, filter?: null): ArchiveEntry | ArchiveDirectory | null
  findInArchives(what: string, filter: RegExp | null = null): ArchiveEntry | ArchiveDirectory | null {
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
        for (let [key, value] of item as ArchiveDirectory) {
          if (filter.exec(key)) {
            result.set(key, value)
          }
        }

        return result
      }

      parent = item as ArchiveDirectory
    }

    return null
  }
}
