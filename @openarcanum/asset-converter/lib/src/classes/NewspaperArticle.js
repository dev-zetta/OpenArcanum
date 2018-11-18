// For more information on Article structure check  any >gamenewspaper.mes<

module.exports = class Newspaper {
  constructor(recordKey, header, subheader = {}, paragraphs = []) {
    this.recordKey = recordKey;
    this.header = header;
    this.subHeader = subheader;
    this.paragraphs = paragraphs;
  }
};
