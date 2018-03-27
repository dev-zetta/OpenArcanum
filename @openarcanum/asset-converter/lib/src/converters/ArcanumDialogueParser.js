//*************
// GENERATORS
//*************

function prepareJson(parserPatternFilePath, inputFilePath) {
    try {
        var allFiles = JSON.parse(readJSONFile(parserPatternFilePath));
        for (var fileName in allFiles) {
            var records = justNormal(inputFilePath + fileName + ".mes");
            var file = allFiles[fileName];
            for (var record in records) {
                if (!addRecordToFile(file, records[record])) {
                    console.log("Could not find matching place for record: {" + records[record].key + ": " + records[record].value + "} from file: " + fileName);
                }
            }
        }
        return allFiles;
    } catch (e) {
        console.log("Error processing file:" + e);
    }
}

function addRecordToFile(file, record) {
    var key = parseInt(record.key);
    for (var i = 0; i < file.length; ++i) {
        for (var def in file[i].default) {
            if (key >= parseInt(file[i].default[def].min) && key <= parseInt(file[i].default[def].max)) {
                file[i].default[def].lines.push(record);
                return true;
            }
        }
        for (var clazz in file[i].classes) {
            if (key >= parseInt(file[i].classes[clazz].min) && key <= parseInt(file[i].classes[clazz].max)) {
                file[i].classes[clazz].lines.push(record);
                return true
            }
        }
        for (var race in file[i].races) {
            if (key >= parseInt(file[i].races[race].min) && key <= parseInt(file[i].races[race].max)) {
                file[i].races[race].lines.push(record);
                return true;
            }
        }
        for (var direction in file[i].directions) {
            if (key >= parseInt(file[i].directions[direction].min) && key <= parseInt(file[i].directions[direction].max)) {
                file[i].directions[direction].lines.push(record);
                return true;
            }
        }
    }
    return false;
}

// ***************
// RECORD PARSER
// ***************

function justNormal(filePath) {
    var data = readFile(filePath);
    return parseTextRecords(data);
}

function parseTextRecords(data) {
    var textRecords = [];
    var messages = data.match(/{\d+}{[\s\S]*?}/g);
    for (var i = 0; i < messages.length; ++i) {
        var record = messages[i].match(/{(.+)}{([\s\S]*?)}/);
        textRecords.push({key: record[1], value: record[2]})
    }
    return textRecords;
}

// *********
// HELPERS
// *********

function writeToFile(obj, filePathAndName) {
    var fs = require('fs');
    fs.writeFile(filePathAndName, JSON.stringify(obj), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file: " + filePathAndName + " was saved!");
    });
}

function readFile(filePathAndName) {
    var fs = require('fs');
    return fs.readFileSync(filePathAndName, {encoding: 'utf-8'}, function (err, data) {
        if (!err) {
        } else {
            console.log(err);
        }
    });
}

function readJSONFile(filePathAndName) {
    var fs = require('fs');
    return fs.readFileSync(filePathAndName, {encoding: 'utf-8'}, function (err, data) {
        if (!err) {
        } else {
            console.log(err);
        }
    });
}

//************
// EXECUTION
//************

var allDialogues = prepareJson("out\\parserPattern.json", "mes\\");
writeToFile(allDialogues, "out\\parsed.json");

