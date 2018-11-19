const readerHelper = require('../../helpers/ReaderHelper');
const AIBehaviour = require('../../classes/AIBehaviour');

//* ************
// GENERATORS
//* ************

module.exports = {
  parseAI: function (file, inputFolder) {
    const data = readerHelper.readFile(inputFolder + file + '.mes');
    const records = readerHelper.readRecords(inputFolder + file + '.mes');
    if (data === null) {
      return null;
    }
    return parseAIs(records);
  }
};

function parseAIs(records) {
  const ai_params = parseAIBehaviours(records);
  return {ai_params};
}

// **********************
//  ai_params
// **********************

function parseAIBehaviours(records) {
  const aiStatsObjects = [];
  records.forEach((record) => {
    const AIStats = parseAIStatsFromRecord(record);
    aiStatsObjects.push(new AIBehaviour(AIStats))
  });
  return aiStatsObjects;
}


// **********************
// HELPERS
// **********************

function parseAIStatsFromRecord(record) {
  const regex = /(\d+)/g;
  const AIStats = [];
  let regexExec;
  for(let i = 0; (regexExec = regex.exec(record.value)) !== null; ++i){
    AIStats.push(regexExec[0]);
  }
  AIStats.push(record.comment);
  AIStats.push(record.key);
  return AIStats;
}
