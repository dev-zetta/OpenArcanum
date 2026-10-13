export interface AuthorityPresentation {
  version: 2
  epoch: number
  sequence: number
  revision: number
  type: 'message'
  targetId?: string
  text: string
}
export interface ScriptMessageState {
  text: string
  targetId?: string
  epoch: number
  sequence: number
}
export interface ScriptObjectState { id: string; off: boolean }
