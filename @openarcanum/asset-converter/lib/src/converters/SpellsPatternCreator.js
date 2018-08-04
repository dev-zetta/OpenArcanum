const readerHelper = require('../helpers/ReaderHelper');
const dictionary = require('../resources/Dictionaries');
const spellRelatedDictionary = dictionary.spellRelated();
const colleges = spellRelatedDictionary.colleges;
const spellsMap = spellRelatedDictionary.spells;
var Spell = require('../classes/Spell');

//* ************
// GENERATORS
//* ************
module.exports = {
  parseSpells: function(file, inputFolder) {
    return parseSpells(inputFolder + file + '.mes');
  }
};

function parseSpells(filePath) {
  var data = readerHelper.readFile(filePath);
  var records = readerHelper.readRecords(filePath);
  if (data === null) {
    return null;
  }
  return prepareSpells(records);
}

// *********
// HELPERS
// *********

function prepareSpells(data) {
  var messageTypes = {};
  var spellNames = Array.from(spellsMap.keys());
  var collegeNames = Array.from(colleges.keys());
  for (var i = 0; i < collegeNames.length; ++i) {
    var collegeName = colleges.get(collegeNames[i]);
    messageTypes[collegeName] = {};
    for (var j = 0; j < 5; ++j) {
      var spellName = spellNames[i * 5 + j];
      var startAt = 1000 + (i * 5 + j) * 50;
      var endAt = startAt + 50;
      var spellRecords = fetchRecordsForRange(data, startAt, endAt);
      var spell = new Spell(spellNames[i * 5 + j], spellRecords, startAt);
      messageTypes[collegeName][spellsMap.get(spellName)] = spell;
    }
  }
  return messageTypes;
}

function prepareClearFile(data) {
  var messageTypes = [];
  var spellNames = Array.from(spellsMap.keys());
  for (var i = 0; i < spellNames.length; ++i) {
    var startAt = 1000 + i * 50;
    var endAt = 1050 + i * 50;
    var records = fetchRecordsForRange(data, startAt, endAt);
    var rec = {};
    for (var j = 0; j < records.length; ++j) {
      rec[records[j].key] = records[j].value;
    }
    messageTypes.push({ name: spellNames[i], records: rec });
  }
  return messageTypes;
}

function fetchRecordsForRange(records, min, max) {
  const recordsToReturn = [];
  for (var j = 0; j < records.length; ++j) {
    if (records[j].key >= max) {
      break;
    }
    if (records[j].key >= min) {
      recordsToReturn.push(records[j]);
    }
  }
  return recordsToReturn;
}
