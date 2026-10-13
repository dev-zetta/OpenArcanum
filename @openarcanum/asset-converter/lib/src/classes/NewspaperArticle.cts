import type { NewspaperLine } from "../types.cjs"
// For more information on Article structure check  any >gamenewspaper.mes<

export = class Newspaper {
  declare recordKey: number;
  declare header: NewspaperLine;
  declare subHeader: NewspaperLine | object;
  declare paragraphs: NewspaperLine[];

  constructor(recordKey: number, header: NewspaperLine, subheader: NewspaperLine | object = {}, paragraphs: NewspaperLine[] = []) {
    this.recordKey = recordKey;
    this.header = header;
    this.subHeader = subheader;
    this.paragraphs = paragraphs;
  }
};
