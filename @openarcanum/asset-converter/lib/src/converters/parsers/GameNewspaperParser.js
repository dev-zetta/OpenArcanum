const readerHelper = require('../../helpers/ReaderHelper');
const NewspaperArticle = require('../../classes/NewspaperArticle');

//* ************
// GENERATORS
//* ************

module.exports = {
  prepareGameNewspapers: function (file, inputFolder) {
    const data = readerHelper.readFile(inputFolder + file + '.mes');
    const records = readerHelper.readRecords(inputFolder + file + '.mes');
    if (data === null) {
      return null;
    }
    return parseNewspapers(records);
  }
};

function parseNewspapers(records) {
  const fillerArticles = parseFillerArticles(records);
  const gameRelatedNewspaperArticles = parseGameRelatedArticles(records);
  const genericArticles = parseGenericArticles(records);
  return {fillerArticles, gameRelatedNewspaperArticles, genericArticles};
}

// **********************
// FILLER ARTICLES 10-25
// **********************

function parseFillerArticles(records) {
  const filteredRecords = readerHelper.fetchRecordsForRange(records, 10, 25);
  const gameRelatedNewspaperArticles = [];
  for (let i = 10; i < 26; i += 2) {
    const recordsForOneNewspaper = readerHelper.fetchRecordsForRange(filteredRecords, i, i + 1);
    if (recordsForOneNewspaper.length) {
      gameRelatedNewspaperArticles.push(prepareNewspaperArticle(recordsForOneNewspaper));
    }
  }
  return gameRelatedNewspaperArticles;
}

// **********************
// GAME RELATED ARTICLES 1000-4990
// **********************

function parseGameRelatedArticles(records) {
  const filteredRecords = readerHelper.fetchRecordsForRange(records, 1000, 4990);
  const gameRelatedNewspaperArticles = [];
  for (let i = 1000; i < 4991; i += 10) {
    const recordsForOneNewspaper = readerHelper.fetchRecordsForRange(filteredRecords, i, i + 9);
    if (recordsForOneNewspaper.length) {
      gameRelatedNewspaperArticles.push(prepareNewspaperArticle(recordsForOneNewspaper));
    }
  }
  return gameRelatedNewspaperArticles;
}

// **********************
// GENERIC ARTICLES 5000-6000
// **********************

function parseGenericArticles(records) {
  const filteredRecords = readerHelper.fetchRecordsForRange(records, 5000, 6000);
  const gameRelatedNewspaperArticles = [];
  for (let i = 5000; i < 6001; i += 10) {
    const recordsForOneNewspaper = readerHelper.fetchRecordsForRange(filteredRecords, i, i + 9);
    if (recordsForOneNewspaper.length) {
      gameRelatedNewspaperArticles.push(prepareNewspaperArticle(recordsForOneNewspaper));
    }
  }
  return gameRelatedNewspaperArticles;
}

// **********************
// HELPERS
// **********************

function prepareNewspaperArticle(records) {
  const recordKey = records[0].key;
  const header = fetchLine(records[0]);
  const subHeader = fetchLine(records[1]);
  const paragraphs = fetchParagraphs(records);

  return new NewspaperArticle(recordKey, header, subHeader, paragraphs);
}

function fetchLine(record) {
  //(490)(l)(  _COUNCIL MURDERED!_)
  const parsed = /([0-9]{3})([lc])([\S\s]+)/.exec(record.value);
  const line = {
    recordKey: record.key,
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

function fetchParagraphs(records) {
  const paragraphs = [];
  for (let i = 2; i < records.length; ++i) {
    paragraphs.push(fetchLine(records[i]));
  }
  return paragraphs;
}

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
