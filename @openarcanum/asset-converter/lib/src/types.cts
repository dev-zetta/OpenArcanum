export interface NewspaperLine { recordKey: number; fontSize: string | undefined; fontStyle: string | undefined; image?: string; text?: string }
export interface DialogueFileInformation { name: string; type: string }
export interface DialoguePattern { filename: string; dialogueTypes: import('./classes/DialogueType.cjs')[] | null | undefined }
export interface MessageType { name?: string; description: string; start?: string | number; end?: string | number; jump?: string | number }
