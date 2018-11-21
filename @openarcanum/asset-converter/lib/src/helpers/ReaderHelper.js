const Record = require('../classes/Record');

module.exports = {
  writeJsonObjectToFile: function (obj, filePathAndName) {
    const fs = require('fs');
    fs.writeFileSync(filePathAndName, JSON.stringify(obj, null, 2), {}, function (err) {
      if (err) {
        return console.log(err);
      }
    });
    console.log('The file: ' + filePathAndName + ' was saved!');
  },

  readFile: function (filePathAndName) {
    const fs = require('fs');
    try {
      return fs.readFileSync(filePathAndName, {encoding: 'utf-8'});
    } catch (e) {
      console.log('Error while reading the file: ' + filePathAndName);
      return null;
    }
  },

  readJSONFile: function (filePathAndName) {
    const fs = require('fs');
    return fs.readFileSync(filePathAndName, {encoding: 'utf-8'}, function (err) {
      if (!err) {
      } else {
        console.log(err);
      }
    });
  },

  // Fetch sub array of records where record keys are <min;max> not <min;max)
  fetchRecordsForRange: function (records, min, max) {
    const recordsToReturn = [];
    for (let j = 0; j < records.length; ++j) {
      if (records[j].key >= min && records[j].key <= max) {
        recordsToReturn.push(records[j]);
      }
    }
    return recordsToReturn;
  },

  readRecords: function (filePathAndName) {
    const fs = require('fs');
    const data = fs.readFileSync(filePathAndName, {encoding: 'utf-8'}, function (err) {
      if (!err) {
      } else {
        console.log(err);
      }
    });
    return parseTextRecords(data);
  }
};

function parseTextRecords(data) {
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
