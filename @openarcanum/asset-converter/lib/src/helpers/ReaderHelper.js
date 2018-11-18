var Record = require('../classes/Record');

module.exports = {
  writeJsonObjectToFile: function (obj, filePathAndName) {
    var fs = require('fs');
    fs.writeFileSync(filePathAndName, JSON.stringify(obj), {}, function (err) {
      if (err) {
        return console.log(err);
      }
    });
    console.log('The file: ' + filePathAndName + ' was saved!');
  },

  readFile: function (filePathAndName) {
    var fs = require('fs');
    try {
      return fs.readFileSync(filePathAndName, {encoding: 'utf-8'});
    } catch (e) {
      console.log('Error while reading the file: ' + filePathAndName);
      return null;
    }
  },

  readJSONFile: function readJSONFile(filePathAndName) {
    var fs = require('fs');
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
    for (var j = 0; j < records.length; ++j) {
      if (records[j].key < min) {
        continue;
      }
      if (records[j].key > max) {
        break;
      }
      if (records[j].key >= min) {
        recordsToReturn.push(records[j]);
      }
    }
    return recordsToReturn;
  },

  readRecords: function readJSONFile(filePathAndName) {
    var fs = require('fs');
    var data = fs.readFileSync(filePathAndName, {encoding: 'utf-8'}, function (err) {
      if (!err) {
      } else {
        console.log(err);
      }
    });
    return parseTextRecords(data);
  }
};

function parseTextRecords(data) {
  var textRecords = [];
  var messages = data.match(/{\d+}{[\s\S]*?}/g);
  for (var i = 0; i < messages.length; ++i) {
    var record = messages[i].match(/{(.+)}{([\s\S]*?)}/);
    textRecords.push(new Record(record[1], record[2]));
  }
  return textRecords;
}
