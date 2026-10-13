import readerHelper = require('../../helpers/ReaderHelper.cjs');
import DialogueType = require('../../classes/DialogueType.cjs');
import type RecordModel from '../../classes/Record.cjs';
interface PatternFile { filename: string; dialogueTypes: { type?: string; description: string; recordRanges?: ConstructorParameters<typeof DialogueType>[2] }[] }
interface ParsedFile { filename: string; dialogueTypes: DialogueType[] }

//* ************
// GENERATORS
//* ************
export = {
  prepareJson: function (parserPatternFilePath: string, inputFilePath: string) {
    try {
      const allFiles = fetchDialogFiles(JSON.parse(readerHelper.readJSONFile(parserPatternFilePath)) as PatternFile[]);
      allFiles.forEach(file => {
        assignRecordsToFile(inputFilePath, file);
      });
      return allFiles;
    } catch (e) {
      console.log('Error processing file:' + e);
    }
  }
};


function assignRecordsToFile(inputFilePath: string, file: ParsedFile) {
  const records = readerHelper.readRecords(inputFilePath + file.filename + '.mes');
  records.forEach((record) => {
    if (!addRecordToDialogTypes(file.dialogueTypes, record)) {
      logError(file.filename, record);
    }
  })
}

function logError(filename: string, record: RecordModel) {
  console.log('Could not find matching place for record: ' + record + ' from file: ' + filename);
}

function fetchDialogFiles(json: PatternFile[]): ParsedFile[] {
  const dialogFiles = [];
  for (const fileIndex in json) {
    const dialogueTypes = fetchDialogueTypesList(json[fileIndex]);
    dialogFiles.push({
      filename: json[fileIndex].filename,
      dialogueTypes: dialogueTypes
    });
  }
  return dialogFiles;
}

function fetchDialogueTypesList(file: PatternFile): DialogueType[] {
  const list: DialogueType[] = [];
  file.dialogueTypes.forEach((item) => {
    list.push(new DialogueType(item.type, item.description, item.recordRanges))
  });
  return list;
}

function addRecordToDialogTypes(dialogueTypes: DialogueType[], record: RecordModel) {
  for (let i = 0; i < dialogueTypes.length; ++i) {
    if (dialogueTypes[i].addRecord(record)) {
      return true;
    }
  }
}
