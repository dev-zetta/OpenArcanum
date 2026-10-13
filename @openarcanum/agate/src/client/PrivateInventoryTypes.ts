import type { CarryingState } from '../shared/character/CarryWeight'

export interface PrivateItem { id: string; slot: number; label: string; type: string; prototypeId: number; quantity?: number; canDrop?: true; weight?: number }
export interface InventoryState { status: string; known: boolean; items: PrivateItem[]; ownerId?: string; revision?: number; message: string; carrying?: CarryingState }
