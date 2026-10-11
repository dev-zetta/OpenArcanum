const Record = require('../classes/Record');

const fs = require('fs');
const iconv = require('iconv-lite');

module.exports = {
  writeJsonObjectToFile: function (obj, filePathAndName) {
    fs.writeFileSync(filePathAndName, JSON.stringify(obj, null, 2), {encoding: 'utf-8'}, function (err) {
      if (err) {
        return console.log(err);
      }
    });
    console.log('The file: ' + filePathAndName + ' was saved!');
  },

  readFile: function (filePathAndName) {

    try {
      let data = fs.readFileSync(filePathAndName);
      if (!data) {
        console.error(`Unable to read ${filePathAndName}`);
        return null;
      }

      data = iconv.decode(data, 'win1251');
      return data.toString('utf8');
    } catch (e) {
      console.log('Error while reading the file: ' + filePathAndName);
      return null;
    }
  },

  readJSONFile: function (filePathAndName) {
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
    let data = fs.readFileSync(filePathAndName, {}, function (err) {
      if (!err) {
      } else {
        console.log(err);
      }
    });

    data = iconv.decode(data, 'win1251')
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
