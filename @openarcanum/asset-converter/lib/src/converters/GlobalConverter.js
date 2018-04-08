const dictionaryPatternParser = require('./GeneralDialoguesPatternCreator.js');
const spellsPatternCreator = require('./SpellsPatternCreator.js');
const dialogFiles = require('../resources/FilesInformation');
const generalDialogueParser = require('./GeneralDialogueParser');
const readerHelper = require('../helpers/ReaderHelper');

const generalDialogueFilename = 'generalDialogue.json';
const generalDialoguePatternFilename = 'dialoguePattern.json';

module.exports = {
  prepareAllPatterns: function(arcanumPath, outputPath) {
    dictionaryPatternParser.writeParserPatternForFiles(
      dialogFiles.generalDialogInformation,
      arcanumPath + 'mes/',
      outputPath,
      generalDialoguePatternFilename
    );
  },

  convertAllFiles: function(arcanumPath, patternsPath, outputPath) {
    var generalDialogues = generalDialogueParser.prepareJson(
      patternsPath + generalDialoguePatternFilename,
      arcanumPath + 'mes/'
    );
    readerHelper.writeJsonObjectToFile(
      generalDialogues,
      outputPath + generalDialogueFilename
    );
    var spells = spellsPatternCreator.parseSpells('SpellList', arcanumPath + 'rules/');
    readerHelper.writeJsonObjectToFile(spells, outputPath + 'SpellList' + '.json');
  }
};
