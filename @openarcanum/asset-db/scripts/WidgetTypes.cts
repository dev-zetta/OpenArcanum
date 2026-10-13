/** Authored widget callbacks are serialized as source and bound to an Ember
 * widget instance by the GUI loader. The definition remains ordinary data. */
export interface WidgetDefinition {
  id?: string
  type?: string
  parent?: string
  prototype?: string
  sprite?: string
  visible?: boolean
  position?: string | (string | number)[]
  size?: (string | number)[]
  orientation?: string
  value?: string | number | boolean
  style?: Record<string, string | number>
  options?: Record<string, unknown>
  animation?: { duration: number; repeat?: number }
  events?: Record<string, unknown>
  listeners?: Record<string, unknown>
  methods?: Record<string, unknown>
  components?: Record<string, WidgetDefinition>
}
export interface WidgetInstance {
  hide(): void
  show(): void
  toggle(): void
  bringToBack(): void
  bringToFront(): void
  getChild(id: string): WidgetInstance
  createChild(definition: WidgetDefinition): unknown
  setValue(value: unknown): void
  setSprite(sprite: string): void
  changeFrame(frame: number): void
  emitEvent(event: string, ...args: unknown[]): void
  callComponent(id: string, method: string, ...args: unknown[]): void
  addSlots(slots: Record<string, WidgetDefinition>): void
}
export interface TabbedWidget extends WidgetInstance { currentTab?: WidgetInstance }
export interface BookTab { name: string; button: string }
export interface BookWidget extends WidgetInstance {
  currentTab: BookTab
  switchTo(index: number): void
  onTabClick(index: number): void
}
export interface Discipline { sprite: string; button: string }
export interface DisciplineWidget extends WidgetInstance {
  currentDiscipline: Discipline
  switchTo(name: string): void
  onDisciplineClick(index: number): void
}
export interface CollegeWidget extends WidgetInstance {
  currentCollege: string
  switchTo(name: string): void
  onSpellClick(index: number): void
}
export interface Schematic { description: { name: string; description: string }; sprite: string }
export interface SchematicModel { filtered(expression: string): Schematic[] }
export interface SchemaWidget extends WidgetInstance {
  getDatabase(): { getModel(name: 'Schematic'): SchematicModel }
  schematicModel: SchematicModel
  currentDiscipline: string
  schematicType: string
  schematics: Schematic[]
  pageIndex: number
  showTab(name: string): void
  showSchematic(index: number): void
  nextPage(): void
  previousPage(): void
  switchToType(type: string): void
}
declare global {
  const AGate: { getGfxUrl(path: string): string }
}
