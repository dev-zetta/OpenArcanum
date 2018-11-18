// For more information on Article structure check  any >gamenewspaper.mes<

module.exports = class Newspaper {
  constructor(records) {
    this.recordId = records[0].key;
    this.header = this.fetchLine(records[0]);
    this.subHeader = this.fetchLine(records[1]);
    this.paragraphs = this.fetchParagraphs(records);
  }

  fetchLine(record) {
    var parsed = /([0-9]{3})([lc])([\S\s]+)/.exec(record.value);
    var line = {
      recordId: record.key,
      fontSize: fontSizes[parsed[1]],
      fontStyle: fontStyles[parsed[2]]
    };
    if (parsed[1] === '488') {
      line.image = parsed[3].replace(/\s/g, '');
    } else {
      line.text = parsed[3];
    }
    return line;
  }

  fetchParagraphs(records) {
    var paragraphs = [];
    for (var i = 2; i < records.length; ++i) {
      paragraphs.push(this.fetchLine(records[i]));
    }
    return paragraphs;
  }
};

// **************
// DICTIONARIES
// **************

const fontSizes = {
  '490': 'Extra Large Headline',
  '486': 'Large Headline',
  '492': 'Normal Headline',
  '483': 'Story Body',
  '488': 'Clip Art/Image'
};

const fontStyles = {
  l: 'left',
  c: 'center'
};
