import { isRecord } from './SessionTypes'
import type Entity from '../shared/entity/Entity'
import type Sprite from './Sprite'
function point(value: unknown, label: string, fallback: {x: number; y: number} | null = null) {
  if (value == null && fallback) return fallback
  const x = Array.isArray(value) ? value[0] : isRecord(value) ? value.x : undefined
  const y = Array.isArray(value) ? value[1] : isRecord(value) ? value.y : undefined
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Invalid object lighting ${label}`)
  }
  return { x, y }
}

/**
 * Original non-wall artwork receives one illumination color, independent of
 * its image height/hotspot. Return the sample in LightLayer's world origin.
 * Rendered isometric coordinates are already scaled by 40 and include smooth
 * actor movement; the retained offset is in screen pixels. Camera transforms
 * and sprite elevation do not move the ground sample.
 *
 * Portals sample the center of the adjoining half-tile selected by their ART
 * side. Their converted x/y axes reverse the original world axes. Use the
 * logical location here: Scene applies separate wall-alignment shifts when
 * positioning portal artwork, which must not move its illumination sample.
 * Walls require a directional color gradient and are intentionally excluded.
 */
export default function objectLightPosition(entity: Entity, sprite: Sprite) {
  const type = String(entity?.base?.type)
  if (type === 'Wall') throw new Error('Wall lighting requires directional samples')
  if (type === 'Portal') {
    const location = point(entity.base.location, 'portal location')
    const side = sprite?.meta?.side ?? entity.visual?.classes?.current?.side
    if (typeof side !== 'number' || !Number.isInteger(side) || side < 0 || side > 7) {
      throw new Error('Invalid object lighting portal side')
    }
    const quadrant = Math.floor(side / 2)
    return {
      x: 40 * (location.x - location.y) + (quadrant < 2 ? 20 : -20),
      y: 20 * (location.x + location.y) + (quadrant === 1 || quadrant === 2 ? 10 : -10)
    }
  }

  const iso = sprite?.iso
  if (!iso || !Number.isFinite(iso.isoX) || !Number.isFinite(iso.isoY)) {
    throw new Error('Invalid object lighting rendered position')
  }
  const offset = point(iso.offset ?? sprite.offset ?? entity?.base?.offset,
    'screen offset', { x: 0, y: 0 })
  return {
    x: iso.isoX - iso.isoY + offset.x,
    y: (iso.isoX + iso.isoY) / 2 + offset.y
  }
}
