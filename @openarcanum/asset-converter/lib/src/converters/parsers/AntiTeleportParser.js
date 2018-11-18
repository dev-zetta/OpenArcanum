const readerHelper = require('../../helpers/ReaderHelper');
const AntiTeleportMap = require('../../classes/AntiTeleportMap');
const AntiTeleportSpot = require('../../classes/AntiTeleportSpot');

//* ************
// GENERATORS
//* ************

module.exports = {
  prepareAntiTeleports: function(file, inputFolder) {
    var data = readerHelper.readFile(inputFolder + file + '.mes');
    var records = readerHelper.readRecords(inputFolder + file + '.mes');
    if (data === null) {
      return null;
    }
    return parseAntiTeleports(records);
  }
};

function parseAntiTeleports(records) {
  const antiTeleportSpots = prepareAntiteleportSpots(records);
  const antiTeleportMaps = prepareAntiteleportMaps(records);
  return { antiTeleportSpots, antiTeleportMaps };
}

// **********************
// AnitTeleportationMaps 1000+
// **********************

function prepareAntiteleportMaps(records) {
  const filteredRecords = readerHelper.fetchRecordsForRange(records, 1000, 1010);
  const maps = [];
  for (var i = 0; i < filteredRecords.length; ++i) {
    maps.push(prepareMap(filteredRecords[i]));
  }
  return maps;
}

// **********************
// AnitTeleportationMaps 100-999
// **********************

function prepareAntiteleportSpots(records) {
  const filteredRecords = readerHelper.fetchRecordsForRange(records, 100, 105);
  const maps = [];
  for (var i = 0; i < filteredRecords.length; ++i) {
    maps.push(prepareSpot(filteredRecords[i]));
  }
  return maps;
}

// **************
// Helpers
// **************

function prepareSpot(record) {
  var parsed = /(\d+), (\d+), (\d+)/.exec(record.value);
  return new AntiTeleportSpot(
    record.key,
    parsed[1],
    parsed[2],
    parsed[3],
    descriptions[record.key]
  );
}

function prepareMap(record) {
  return new AntiTeleportMap(record.key, record.value, descriptions[record.key]);
}

// **************
// DICTIONARIES
// **************

const descriptions = {
  '100': 'Close to the Home of Maximillian  (Just south of it)',
  '101': 'The area surrounding the home of the Dark Elves',

  '1000': "Fa'al Kin's Maze",
  '1001': 'VOID',
  '1002': "VOID - Arronax's Interior",
  '1003': 'VOID -Kerghans Castle',
  '1004': "VOID - Cave Of Kriggyrd's Falchion"
};
