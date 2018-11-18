const readerHelper = require('../../helpers/ReaderHelper');
var NewspaperArticle = require('../../classes/NewspaperArticle');

//* ************
// GENERATORS
//* ************

module.exports = {
  prepareGameNewspapers: function(file, inputFolder) {
    var data = readerHelper.readFile(inputFolder + file + '.mes');
    var records = readerHelper.readRecords(inputFolder + file + '.mes');
    if (data === null) {
      return null;
    }
    return parseNewspapers(records);
  }
};

function parseNewspapers(records) {
  var fillerArticles = parseFillerArticles(records);
  var gameRelatedNewspaperArticles = parseGameRelatedArticles(records);
  var genericArticles = parseGenericArticles(records);
  return { fillerArticles, gameRelatedNewspaperArticles, genericArticles };
}

// **********************
// FILLER ARTICLES 10-25
// **********************

function parseFillerArticles(records) {
  var filteredRecords = readerHelper.fetchRecordsForRange(records, 10, 25);
  var gameRelatedNewspaperArticles = [];
  for (let i = 10; i < 26; i += 2) {
    var recordsForOneNewspaper = readerHelper.fetchRecordsForRange(
      filteredRecords,
      i,
      i + 1
    );
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
  var filteredRecords = readerHelper.fetchRecordsForRange(records, 1000, 4990);
  var gameRelatedNewspaperArticles = [];
  for (let i = 1000; i < 4991; i += 10) {
    var recordsForOneNewspaper = readerHelper.fetchRecordsForRange(
      filteredRecords,
      i,
      i + 9
    );
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
  var filteredRecords = readerHelper.fetchRecordsForRange(records, 5000, 6000);
  var gameRelatedNewspaperArticles = [];
  for (let i = 5000; i < 6001; i += 10) {
    var recordsForOneNewspaper = readerHelper.fetchRecordsForRange(
      filteredRecords,
      i,
      i + 9
    );
    if (recordsForOneNewspaper.length) {
      gameRelatedNewspaperArticles.push(prepareNewspaperArticle(recordsForOneNewspaper));
    }
  }
  return gameRelatedNewspaperArticles;
}

// **********************
// HELPERS
// **********************

function prepareNewspaperArticle(records){
  var recordKey = records[0].key;
  var header = fetchLine(records[0]);
  var subHeader = fetchLine(records[1]);
  var paragraphs = fetchParagraphs(records);

  return new NewspaperArticle(recordKey, header, subHeader, paragraphs);
}

function fetchLine(record) {
  var parsed = /([0-9]{3})([lc])([\S\s]+)/.exec(record.value);
  var line = {
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
  var paragraphs = [];
  for (var i = 2; i < records.length; ++i) {
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
