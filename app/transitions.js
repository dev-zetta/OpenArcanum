export default function() {
  this.transition(
    this.fromRoute(`index`),
    this.toRoute(`ingame`),
    this.use(`toLeft`),
    this.reverse(`toRight`)
  )
}
