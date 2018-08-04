const readerHelper = require('../helpers/ReaderHelper');

//* ************
// GENERATORS
//* ************
module.exports = {
  prepareJson: function prepareJson(parserPatternFilePath, inputFilePath) {
    try {
      var allFiles = JSON.parse(readerHelper.readJSONFile(parserPatternFilePath));
      for (var fileName in allFiles) {
        var records = readRecordsFromFile(inputFilePath + fileName + '.mes');
        var dialogueTypes = allFiles[fileName];
        for (var record in records) {
          if (!addRecordToDialogTypes(dialogueTypes, records[record])) {
            console.log(
              'Could not find matching place for record: {' +
                records[record].key +
                ': ' +
                records[record].value +
                '} from file: ' +
                fileName
            );
          }
        }
      }
      return allFiles;
    } catch (e) {
      console.log('Error processing file:' + e);
    }
  }
};

const RecordAddedException = {};

function addRecordToDialogTypes(dialogueTypes, record) {
  const key = parseInt(record.key);

  try {
    dialogueTypes.forEach(dialogueType => {
      addRecordToDefault(dialogueType, record, key);
      addRecordToClass(dialogueType, record, key);
      addRecordToRace(dialogueType, record, key);
      addRecordToDirection(dialogueType, record, key);
    });
  } catch (exception) {
    return exception === RecordAddedException;
  }
}

function addRecordToDefault(dialogueType, record, recordKey) {
  dialogueType.default.forEach(def => {
    if (recordKey >= parseInt(def.min) && recordKey <= parseInt(def.max)) {
      def.lines.push(record);
      throw RecordAddedException;
    }
  });
}

function addRecordToClass(dialogueType, record, recordKey) {
  for (var key in dialogueType.classes) {
    if (
      recordKey >= parseInt(dialogueType.classes[key].min) &&
      recordKey <= parseInt(dialogueType.classes[key].max)
    ) {
      dialogueType.classes[key].lines.push(record);
      throw RecordAddedException;
    }
  }
}

function addRecordToRace(dialogueType, record, recordKey) {
  for (var key in dialogueType.races) {
    if (
      recordKey >= parseInt(dialogueType.races[key].min) &&
      recordKey <= parseInt(dialogueType.races[key].max)
    ) {
      dialogueType.races[key].lines.push(record);
      throw RecordAddedException;
    }
  }
}

function addRecordToDirection(dialogueType, record, recordKey) {
  for (var key in dialogueType.directions) {
    if (
      recordKey >= parseInt(dialogueType.directions[key].min) &&
      recordKey <= parseInt(dialogueType.directions[key].max)
    ) {
      dialogueType.directions[key].lines.push(record);
      throw RecordAddedException;
    }
  }
}

// ***************
// RECORD PARSER
// ***************

function readRecordsFromFile(filePath) {
  var data = readerHelper.readFile(filePath);
  return parseTextRecords(data);
}

function parseTextRecords(data) {
  var textRecords = [];
  var messages = data.match(/{\d+}{[\s\S]*?}/g);
  for (var i = 0; i < messages.length; ++i) {
    var record = messages[i].match(/{(.+)}{([\s\S]*?)}/);
    textRecords.push({ key: record[1], value: record[2] });
  }
  return textRecords;
}
