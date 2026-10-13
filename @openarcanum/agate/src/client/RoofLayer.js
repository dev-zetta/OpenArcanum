import Sprite from './Sprite'
import Sector from '../shared/map/Sector'
import { createAlphaHitArea } from './AlphaHitArea'

// Roof cells cover 4x4 ground tiles. Piece coverage and directional boundaries
// follow the original roof format (also documented in Arcanum CE's roof.c).
const blockedPieces = {
  1: [0, 1, 4],
  3: [0, 2, 7],
  5: [7, 9, 11],
  7: [4, 9, 10]
}
const neighbors = [[0, 1, 5], [0, -1, 1], [1, 0, 3], [-1, 0, 7]]

export default class RoofLayer {
  constructor(scene, map) {
    this.scene = scene
    this.map = map
    this.container = scene.newGroup(map.rootGroup)
    this.cells = new Map()
    this.hidden = new Set()
    this.ground = []
    this.objects = new Map()
    this.lastLocation = null
  }

  static covers(piece, runtimeX, runtimeY) {
    // Runtime coordinates reverse the original SEC axes.
    const x = runtimeY % 4
    const y = runtimeX % 4
    switch (piece) {
      case 0: return y > 1 && x < 3
      case 1: return x < 3
      case 2: return y > 1
      case 3: return x < 3 || y > 1
      case 4: return x < 3 && y < 3
      case 5: return x < 3 || y < 3
      case 6: return x > 1 || y > 1
      case 7: return x > 1 && y > 1
      case 8: return true
      case 9: return x > 1 && y < 3
      case 10: return y < 3
      case 11: return x > 1
      case 12: return x > 1 || y < 3
      default: return false
    }
  }

  async addSector(sector) {
    for (const tile of (sector.tiles || []).flat()) {
      if (tile?.sprite) this.ground.push(tile)
    }
    for (let y = 0; y < (sector.roofs || []).length; y++) {
      const row = sector.roofs[y]
      if (!Array.isArray(row)) continue // Legacy archives have missing roof rows.
      for (let x = 0; x < row.length; x++) {
        const roof = row[x]
        if (!roof) continue
        if (roof.resource?.type !== 'Roof' || !Number.isInteger(roof.piece) || roof.piece < 0 || roof.piece > 12) {
          throw new Error(`Invalid converted roof at ${sector.id}/${x},${y}`)
        }
        const cellX = sector.x * 16 + x
        const cellY = sector.y * 16 + y
        const sprite = new Sprite(this.scene)
        await sprite.load(roof.resource)
        this.scene.addSprite(sprite, this.container,
          (cellX * 4 + 2) * Sector.TileHeight,
          (cellY * 4 + 2) * Sector.TileHeight, 0, { x: -160, y: -220 })
        // The original roof origin is location_xy-(120,200), relative to its
        // normalized cell center. Our entity origin is globally 20px above CE.
        // Flipped roof ART uses hotX=0, unlike generic mirrored object hotspots.
        if (roof.resource.flipped) sprite.iso.anchor.x = 1
        sprite.iso.hitArea = createAlphaHitArea(sprite.iso)
        sprite.setData({ type: 'Roof', roof })
        // Match original y-major/x-minor roof drawing in the reversed axes.
        sprite.iso.zIndex = cellX * this.map.height * 16 + cellY
        roof.sprite = sprite
        this.cells.set(`${cellX},${cellY}`, { roof, sprite, x: cellX, y: cellY })
      }
    }
    this.container.sortChildren()
  }

  updateVisibility(location) {
    if (!location) return
    const key = `${location.x},${location.y}`
    if (key === this.lastLocation) return
    this.lastLocation = key
    for (const cell of this.hidden) cell.sprite.iso.visible = true
    this.hidden.clear()
    const start = this.cells.get(`${Math.floor(location.x / 4)},${Math.floor(location.y / 4)}`)
    // Hide the connected roof above the player, stopping at the format's edge
    // pieces. Restore the previous roof when exiting or entering another one.
    const pending = start && RoofLayer.covers(start.roof.piece, location.x, location.y) ? [[start, 0]] : []
    while (pending.length) {
      const [cell, direction] = pending.pop()
      if (this.hidden.has(cell) || blockedPieces[direction]?.includes(cell.roof.piece)) continue
      cell.sprite.iso.visible = false
      this.hidden.add(cell)
      for (const [dx, dy, incoming] of neighbors) {
        const next = this.cells.get(`${cell.x + dx},${cell.y + dy}`)
        if (next) pending.push([next, incoming])
      }
    }
    // Covered interiors are omitted beneath visible roofs. The coverage test
    // uses the original +3 tile lookup, rather than hiding a whole 4x4 cell.
    for (const tile of this.ground) {
      tile.sprite.iso.visible = tile.outdoor !== false || !this.isCovered(tile.location)
    }
    for (const { entity, sprite } of this.objects.values()) {
      const position = entity.base.location
      const tile = this.map.getTile(position.x, position.y)
      sprite.iso.visible = tile?.outdoor !== false || !this.isCovered(position, true)
    }
  }

  trackEntity(entity, sprite) {
    this.objects.set(entity.id, { entity, sprite })
  }

  isCovered(location, checkFaded = false) {
    const x = location.x + 3
    const y = location.y + 3
    const cell = this.cells.get(`${Math.floor(x / 4)},${Math.floor(y / 4)}`)
    return !!(cell && !this.hidden.has(cell) &&
      (checkFaded || !cell.roof.fade) && RoofLayer.covers(cell.roof.piece, x, y))
  }
}
