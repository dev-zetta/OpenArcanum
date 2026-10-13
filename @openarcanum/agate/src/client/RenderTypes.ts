import type Sprite from './Sprite'
import type Location from '../shared/Location'
export interface ArtResource extends Record<string, unknown> { type?: string; category?: string; name?: string; flipped?: boolean; side?: number; stage?: string | number; frame?: number }
export interface RoofData { piece: number; fade?: boolean; resource: ArtResource; sprite?: Sprite }
export interface RenderedTile { type?: string; blocked?: boolean; outdoor?: boolean; location: Location; resource?: ArtResource; sprite?: Sprite }
export interface RoofSector { id: string; x: number; y: number; tiles?: Array<Array<RenderedTile | null>>; roofs?: Array<Array<RoofData | null>> }
