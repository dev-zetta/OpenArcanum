import fs, { type FileHandle } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export const MAX_CHECKPOINT_BYTES = 1024 * 1024

type CheckpointErrorCode = 'CHECKPOINT_NOT_FOUND' | 'CHECKPOINT_INVALID' | 'CHECKPOINT_IO_ERROR'
const errorCode = (error: unknown): unknown => error && typeof error === 'object' && 'code' in error ? error.code : undefined

function failure(code: CheckpointErrorCode) {
  const messages = {
    CHECKPOINT_NOT_FOUND: 'No local checkpoint has been saved yet.',
    CHECKPOINT_INVALID: 'The checkpoint file is invalid or too large.',
    CHECKPOINT_IO_ERROR: 'The local checkpoint could not be read or written.'
  }
  return Object.assign(new Error(messages[code]), { code })
}

// Storage owns only a configured slot, never a client-supplied path. World and
// compatibility validation belongs to AuthorityServer before it applies data.
export default class CheckpointStore {
  readonly filename: string
  readonly fs: typeof fs
  constructor(filename: string, { filesystem = fs }: { filesystem?: typeof fs } = {}) {
    if (typeof filename !== 'string' || !filename) throw new Error('A checkpoint path is required')
    this.filename = path.resolve(filename)
    this.fs = filesystem
  }

  async checkTarget(allowMissing: boolean) {
    try {
      const stat = await this.fs.lstat(this.filename)
      if (!stat.isFile() || stat.isSymbolicLink()) throw failure('CHECKPOINT_IO_ERROR')
    } catch (error) {
      if (allowMissing && errorCode(error) === 'ENOENT') return
      throw error
    }
  }

  async write(document: unknown) {
    let bytes: Buffer
    try {
      if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Invalid document')
      bytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8')
      if (bytes.length > MAX_CHECKPOINT_BYTES) throw new Error('Oversized document')
    } catch (_) { throw failure('CHECKPOINT_INVALID') }
    const directory = path.dirname(this.filename)
    const temporary = path.join(directory, `.${path.basename(this.filename)}.${randomUUID()}.tmp`)
    let handle: FileHandle | null | undefined
    try {
      await this.fs.mkdir(directory, { recursive: true, mode: 0o700 })
      const stat = await this.fs.lstat(directory)
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw failure('CHECKPOINT_IO_ERROR')
      await this.checkTarget(true)
      handle = await this.fs.open(temporary, 'wx', 0o600)
      await handle.writeFile(bytes)
      await handle.sync()
      await handle.close()
      handle = null
      await this.checkTarget(true)
      await this.fs.rename(temporary, this.filename)
      // Rename is the commit point. Directory fsync is best effort on platforms
      // that cannot open directories; never report failure after committing.
      let parent: FileHandle | undefined
      try { parent = await this.fs.open(directory, 'r'); await parent.sync() }
      catch (_) { /* Atomic replacement and file fsync already succeeded. */ }
      finally { await parent?.close().catch(() => {}) }
    } catch (_) { throw failure('CHECKPOINT_IO_ERROR') }
    finally {
      await handle?.close().catch(() => {})
      await this.fs.unlink(temporary).catch(() => {})
    }
  }

  async read(): Promise<unknown> {
    let handle: FileHandle | null | undefined
    try {
      const directory = await this.fs.lstat(path.dirname(this.filename))
      if (!directory.isDirectory() || directory.isSymbolicLink()) throw failure('CHECKPOINT_IO_ERROR')
      await this.checkTarget(false)
      handle = await this.fs.open(this.filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0))
      const stat = await handle.stat()
      if (!stat.isFile()) throw failure('CHECKPOINT_IO_ERROR')
      if (stat.size > MAX_CHECKPOINT_BYTES) throw failure('CHECKPOINT_INVALID')
      const bytes = Buffer.alloc(MAX_CHECKPOINT_BYTES + 1)
      let length = 0
      while (length < bytes.length) {
        const result = await handle.read(bytes, length, bytes.length - length, length)
        if (!result.bytesRead) break
        length += result.bytesRead
      }
      if (length > MAX_CHECKPOINT_BYTES) throw failure('CHECKPOINT_INVALID')
      try { return JSON.parse(bytes.toString('utf8', 0, length)) }
      catch (_) { throw failure('CHECKPOINT_INVALID') }
    } catch (error) {
      if (['CHECKPOINT_INVALID', 'CHECKPOINT_IO_ERROR'].includes(String(errorCode(error)))) throw error
      throw failure(errorCode(error) === 'ENOENT' ? 'CHECKPOINT_NOT_FOUND' : 'CHECKPOINT_IO_ERROR')
    } finally { await handle?.close().catch(() => {}) }
  }
}
