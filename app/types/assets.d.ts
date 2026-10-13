declare module '*.hbs' {
  import type { TemplateFactory } from '@glimmer/interfaces'
  const template: TemplateFactory
  export default template
}

declare module '*.scss' {}
declare module '*.css' {}
