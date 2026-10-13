declare module 'jspanel4' {
  export interface Panel extends HTMLElement {
    titlebar: HTMLElement
    status: string
    minimize(): void
    normalize(): void
  }
  export interface PanelOptions {
    headerLogo?: string; headerTitle?: string; headerControls?: { maximize: string }
    position?: string | { left: string | number; top: string | number } | null
    contentSize?: { width: string | number; height: string | number } | null
    content: Element; dragit?: { snap: boolean }; resizeit?: boolean; contentOverflow?: string
    callback?(panel: Panel): void; onbeforeclose?(): boolean
  }
  export const jsPanel: { create(options: PanelOptions): Panel }
}
