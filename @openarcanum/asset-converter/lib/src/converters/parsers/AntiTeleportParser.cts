import readerHelper = require('../../helpers/ReaderHelper.cjs');
import AntiTeleportMap = require('../../classes/AntiTeleportMap.cjs');
import AntiTeleportSpot = require('../../classes/AntiTeleportSpot.cjs');

//* ************
// GENERATORS
//* ************

export = {
  prepareAntiTeleports: function(file: string, inputFolder: string) {
    const data = readerHelper.readFile(inputFolder + file + '.mes');
    const records = readerHelper.readRecords(inputFolder + file + '.mes');
    if (data === null) {
      return null;
    }
    return parseAntiTeleports(records);
  }
};

function parseAntiTeleports(records: import("../../classes/Record.cjs")[]) {
  const antiTeleportSpots = prepareAntiteleportSpots(records);
  const antiTeleportMaps = prepareAntiteleportMaps(records);
  return { antiTeleportSpots, antiTeleportMaps };
}

// **********************
// AnitTeleportationMaps 1000+
// **********************

function prepareAntiteleportMaps(records: import("../../classes/Record.cjs")[]) {
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

function prepareAntiteleportSpots(records: import("../../classes/Record.cjs")[]) {
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

function prepareSpot(record: import("../../classes/Record.cjs")) {
  const parsed = /(\d+), (\d+), (\d+)/.exec(record.value);
  if (!parsed) throw new SyntaxError("Invalid anti-teleport spot record");
  return new AntiTeleportSpot(
    record.key,
    parsed[1],
    parsed[2],
    parsed[3],
    record.comment
  );
}

function prepareMap(record: import("../../classes/Record.cjs")) {
  return new AntiTeleportMap(record.key, record.value, record.comment);
}
