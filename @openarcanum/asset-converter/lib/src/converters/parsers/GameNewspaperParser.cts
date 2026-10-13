import type { NewspaperLine } from "../../types.cjs"
import readerHelper = require('../../helpers/ReaderHelper.cjs');
import NewspaperArticle = require('../../classes/NewspaperArticle.cjs');

//* ************
// GENERATORS
//* ************

export = {
  prepareGameNewspapers: function (file: string, inputFolder: string) {
    const data = readerHelper.readFile(inputFolder + file + '.mes');
    const records = readerHelper.readRecords(inputFolder + file + '.mes');
    if (data === null) {
      return null;
    }
    return parseNewspapers(records);
  }
};

function parseNewspapers(records: import("../../classes/Record.cjs")[]) {
  const fillerArticles = parseFillerArticles(records);
  const gameRelatedNewspaperArticles = parseGameRelatedArticles(records);
  const genericArticles = parseGenericArticles(records);
  return {fillerArticles, gameRelatedNewspaperArticles, genericArticles};
}

// **********************
// FILLER ARTICLES 10-25
// **********************

function parseFillerArticles(records: import("../../classes/Record.cjs")[]) {
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

function parseGameRelatedArticles(records: import("../../classes/Record.cjs")[]) {
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

function parseGenericArticles(records: import("../../classes/Record.cjs")[]) {
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

function prepareNewspaperArticle(records: import("../../classes/Record.cjs")[]) {
  const recordKey = records[0].key;
  const header = fetchLine(records[0]);
  const subHeader = fetchLine(records[1]);
  const paragraphs = fetchParagraphs(records);

  return new NewspaperArticle(recordKey, header, subHeader, paragraphs);
}

function fetchLine(record: import("../../classes/Record.cjs")) {
  //(490)(l)(  _COUNCIL MURDERED!_)
  const parsed = /([0-9]{3})([lc])([\S\s]+)/.exec(record.value);
  if (!parsed) throw new SyntaxError("Invalid newspaper line record");
  const line: NewspaperLine = {
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

function fetchParagraphs(records: import("../../classes/Record.cjs")[]) {
  const paragraphs = [];
  for (let i = 2; i < records.length; ++i) {
    paragraphs.push(fetchLine(records[i]));
  }
  return paragraphs;
}

// **************
// DICTIONARIES
// **************

const fontSizes: { [code: string]: string | undefined } = {
  '490': 'Extra Large Headline',
  '486': 'Large Headline',
  '492': 'Normal Headline',
  '483': 'Story Body',
  '488': 'Clip Art/Image'
};

const fontStyles: { [code: string]: string | undefined } = {
  l: 'left',
  c: 'center'
};
