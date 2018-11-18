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
      gameRelatedNewspaperArticles.push(new NewspaperArticle(recordsForOneNewspaper));
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
      gameRelatedNewspaperArticles.push(new NewspaperArticle(recordsForOneNewspaper));
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
      gameRelatedNewspaperArticles.push(new NewspaperArticle(recordsForOneNewspaper));
    }
  }
  return gameRelatedNewspaperArticles;
}
