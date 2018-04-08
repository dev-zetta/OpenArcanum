class Spell {
  constructor(name, records, startAt) {
    this.name = name;
    this.castingEffect = 'Instant';
    this.maintain = false;
    this.resist = false;
    this.range = 'MaxVisible';
    this.minIq = 6;
    this.info = 'Neutral';
    this.cost = 0;

    this.effects = [];

    this.parseRecordsToSpell(records, startAt);
  }

  parseRecordsToSpell(records, startAt) {
    for (var i = 0; i < records.length; ++i) {
      var _record = records[i];
      switch (_record.key - startAt) {
        case 0:
          this.parseTargetingRecord(_record);
          break;
        case 1:
          this.parseCostRecord(_record);
          break;
        case 2:
          this.parseMissleRecord(_record);
          break;
        case 3:
          this.parseFlagsRecord(_record);
          break;
        case 4:
          this.parseAiRecord(_record);
          break;
        default:
          this.parseEffectRecord(_record);
          break;
      }
    }
  }

  parseTargetingRecord(record) {}

  parseMissleRecord(record) {}

  parseCostRecord(record) {
    var _temp = record.value.replace(/: /g, '":"');
    _temp = _temp.replace(/, /g, '","');
    var parsedInfo = JSON.parse('{"' + _temp + '"}');
    this.maintain = parsedInfo.Maintain || this.maintain;
    this.cost = parsedInfo.Cost || this.cost;
    this.resist = parsedInfo.Resist || this.resist;
    this.range = parsedInfo.Range || this.range;
    this.info = parsedInfo.Info || this.info;
  }

  parseFlagsRecord(record) {}

  parseAiRecord(record) {}

  parseEffectRecord(record) {}
}

const readerHelper = require('../helpers/ReaderHelper');
const dictionary = require('../resources/Dictionaries');
const colleges = dictionary.spellList().colleges;
const spellsMap = dictionary.spellList().spells;

//* ************
// GENERATORS
//* ************
module.exports = {
  generatePatternForSingleFile: function(file, inputFolder, outputFolder) {
    var generated = generatePatternForSingleFile(inputFolder + file + '.mes', file);
    readerHelper.writeJsonObjectToFile(generated, outputFolder + file + '.json');

    var clear = generatePatternForSingleFileCLEAR(inputFolder + file + '.mes', file);
    readerHelper.writeJsonObjectToFile(clear, outputFolder + file + 'CLEAR.json');
  }
};

function generatePatternForSingleFile(filePath, file) {
  var data = readerHelper.readFile(filePath);
  var records = readerHelper.readRecords(filePath);
  if (data === null) {
    return null;
  }
  return prepareSpells(records);
}

function generatePatternForSingleFileCLEAR(filePath, file) {
  var data = readerHelper.readFile(filePath);
  var records = readerHelper.readRecords(filePath);
  if (data === null) {
    return null;
  }
  return prepareClearFile(records);
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
      var endAt = 1000 + (i * 5 + j + 1) * 50;
      var spellRecords = fetchRecordsForRange(data, startAt, endAt);
      var spell = new Spell(spellNames[i * 5 + j], spellRecords, startAt);
      messageTypes[collegeName][spellsMap.get(spellName)] = spell;
      console.log(spell);
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
  for (let j = 0; j < records.length; ++j) {
    if (records[j].key >= max) {
      break;
    }
    if (records[j].key >= min) {
      recordsToReturn.push(records[j]);
    }
  }
  return recordsToReturn;
}

module.exports.generatePatternForSingleFile(
  'SpellList',
  'C:/Users/Lorthiz/Desktop/rules/',
  '../Resources/out/'
);
