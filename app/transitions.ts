interface TransitionMap {
  transition(...rules: unknown[]): void
  fromRoute(name: string): unknown
  toRoute(name: string): unknown
  use(name: string): unknown
  reverse(name: string): unknown
}
export default function(this: TransitionMap): void {
  this.transition(this.fromRoute('index'), this.toRoute('ingame'), this.use('toLeft'), this.reverse('toRight'))
}
