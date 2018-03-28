module.exports = {
  writeJsonObjectToFile: function (obj, filePathAndName) {
    var fs = require('fs');
    fs.writeFile(filePathAndName, JSON.stringify(obj), function (err) {
      if (err) {
        return console.log(err);
      }
      console.log("The file: " + filePathAndName + " was saved!");
    });
  },

  readFile: function (filePathAndName) {
    var fs = require('fs');
    try {
      return fs.readFileSync(filePathAndName, {encoding: 'utf-8'});
    } catch (e) {
      console.log("Error while reading the file: " + filePathAndName);
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
  }
};

