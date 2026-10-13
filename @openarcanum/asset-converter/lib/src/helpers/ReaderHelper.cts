import Record = require('../classes/Record.cjs');

import fs = require('fs');
import iconv = require('iconv-lite');

export = {
  writeJsonObjectToFile: function (obj: unknown, filePathAndName: string) {
    fs.writeFileSync(filePathAndName, JSON.stringify(obj, null, 2), {encoding: 'utf-8'});
    console.log('The file: ' + filePathAndName + ' was saved!');
  },

  readFile: function (filePathAndName: string): string | null {

    try {
      const data = fs.readFileSync(filePathAndName);
      if (!data) {
        console.error(`Unable to read ${filePathAndName}`);
        return null;
      }

      return iconv.decode(data, 'win1251');
    } catch (e) {
      console.log('Error while reading the file: ' + filePathAndName);
      return null;
    }
  },

  readJSONFile: function (filePathAndName: string): string {
    return fs.readFileSync(filePathAndName, {encoding: 'utf-8'});
  },

  // Fetch sub array of records where record keys are <min;max> not <min;max)
  fetchRecordsForRange: function (records: Record[], min: number, max: number): Record[] {
    const recordsToReturn = [];
    for (let j = 0; j < records.length; ++j) {
      if (records[j].key >= min && records[j].key <= max) {
        recordsToReturn.push(records[j]);
      }
    }
    return recordsToReturn;
  },

  readRecords: function (filePathAndName: string): Record[] {
    const data = fs.readFileSync(filePathAndName);
    return parseTextRecords(iconv.decode(data, 'win1251'));
  }
};

function parseTextRecords(data: string): Record[] {
  const textRecords = [];
  // {(FIRST GROUP)}{(SECOND GROUP)} // (THIRD GROUP)
  const regex = /{(\d+)}{([\S\s]*?)}(?:[ \t]*?\/\/[ \t]*([\S].*))?/g;
  let regexExec;
  while ((regexExec = regex.exec(data)) !== null) {
    const record = new Record(regexExec[1], regexExec[2], regexExec[3]);
    textRecords.push(record);
  }
  return textRecords;
}
