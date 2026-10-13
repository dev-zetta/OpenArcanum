import { Droppable } from '@shopify/draggable'

export default class GuiDroppable extends Droppable {
  dropZones: HTMLElement[] = []
  constructor(container: HTMLElement | HTMLElement[], options: Omit<NonNullable<ConstructorParameters<typeof Droppable>[1]>, 'dropzone'>) {
    // Draggable evaluates this callback after construction, when dropZones exists.
    const dropzone = (): HTMLElement[] => this.dropZones
    super(container, { ...options, dropzone })
  }
  addDropzone(element: HTMLElement): void { if (!this.dropZones.includes(element)) this.dropZones.push(element) }
  removeDropzone(element: HTMLElement): void { const index = this.dropZones.indexOf(element); if (index !== -1) this.dropZones.splice(index, 1) }
}
