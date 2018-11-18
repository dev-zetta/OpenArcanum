const readerHelper = require('../../helpers/ReaderHelper');
const DialogueType = require('../../classes/DialogueType');

//* ************
// GENERATORS
//* ************
module.exports = {
  prepareJson: function prepareJson(parserPatternFilePath, inputFilePath) {
    try {
      var allFiles = fetchDialogFiles(JSON.parse(readerHelper.readJSONFile(parserPatternFilePath)));
      allFiles.forEach(file => {
        assignRecordsToFile(inputFilePath, file);
      });
      return allFiles;
    } catch (e) {
      console.log('Error processing file:' + e);
    }
  }
};


function assignRecordsToFile(inputFilePath, file) {
  var records = readerHelper.readRecords(inputFilePath + file.filename + '.mes');
  records.forEach((record) => {
    if (!addRecordToDialogTypes(file.dialogueTypes, record)) {
      logError(file.filename, record);
    }
  })
}

function logError(filename, record) {
  console.log('Could not find matching place for record: ' + record + ' from file: ' + filename);
}

function fetchDialogFiles(json) {
  var dialogFiles = [];
  for (var fileIndex in json) {
    var dialogueTypes = fetchDialogueTypesList(json[fileIndex]);
    dialogFiles.push({
      filename: json[fileIndex].filename,
      dialogueTypes: dialogueTypes
    });
  }
  return dialogFiles;
}

function fetchDialogueTypesList(file) {
  var list = [];
  file.dialogueTypes.forEach((item) => {
    list.push(new DialogueType(item.type, item.description, item.recordRanges))
  });
  return list;
}

function addRecordToDialogTypes(dialogueTypes, record) {
  for (var i = 0; i < dialogueTypes.length; ++i) {
    if (dialogueTypes[i].addRecord(record)) {
      return true;
    }
  }
}
