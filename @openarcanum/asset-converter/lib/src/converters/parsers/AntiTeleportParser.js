const readerHelper = require('../../helpers/ReaderHelper');
const AntiTeleportMap = require('../../classes/AntiTeleportMap');
const AntiTeleportSpot = require('../../classes/AntiTeleportSpot');

//* ************
// GENERATORS
//* ************

module.exports = {
  prepareAntiTeleports: function(file, inputFolder) {
    const data = readerHelper.readFile(inputFolder + file + '.mes');
    const records = readerHelper.readRecords(inputFolder + file + '.mes');
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
  for (let i = 0; i < filteredRecords.length; ++i) {
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
  for (let i = 0; i < filteredRecords.length; ++i) {
    maps.push(prepareSpot(filteredRecords[i]));
  }
  return maps;
}

// **************
// Helpers
// **************

function prepareSpot(record) {
  const parsed = /(\d+), (\d+), (\d+)/.exec(record.value);
  return new AntiTeleportSpot(
    record.key,
    parsed[1],
    parsed[2],
    parsed[3],
    record.comment
  );
}

function prepareMap(record) {
  return new AntiTeleportMap(record.key, record.value, record.comment);
}
