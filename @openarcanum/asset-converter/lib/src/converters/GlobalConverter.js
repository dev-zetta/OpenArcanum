const generalDialoguePatternCreator = require('./patternsCreators/GeneralDialoguesPatternCreator.js');
const spellsPatternCreator = require('./parsers/SpellsListParser.js');
const newspaperConverter = require('./parsers/GameNewspaperParser.js');
const dialogFiles = require('../resources/FilesInformation');
const generalDialogueParser = require('./parsers/GeneralDialogueParser');
const readerHelper = require('../helpers/ReaderHelper');

const generalDialogueFilename = 'generalDialogue.json';
const generalDialoguePatternFilename = 'dialoguePattern.json';

module.exports = {
  prepareAllPatterns: function(arcanumPath, outputPath) {
    generalDialoguePatternCreator.writeParserPatternForFiles(
      dialogFiles.generalDialogInformation,
      arcanumPath + 'Arcanum3/mes/',
      outputPath,
      generalDialoguePatternFilename
    );
  },

  convertAllFiles: function(arcanumPath, patternsPath, outputPath) {
    const generalDialogues = generalDialogueParser.prepareJson(
      patternsPath + generalDialoguePatternFilename,
      arcanumPath + 'Arcanum3/mes/'
    );
    readerHelper.writeJsonObjectToFile(
      generalDialogues,
      outputPath + generalDialogueFilename
    );

    const spells = spellsPatternCreator.parseSpells(
      'SpellList',
      arcanumPath + 'Arcanum4/Rules/'
    );
    readerHelper.writeJsonObjectToFile(spells, outputPath + 'SpellList' + '.json');

    const gameNewspaper = newspaperConverter.prepareGameNewspapers(
      'gamenewspaper',
      arcanumPath + 'modules/Arcanum/mes/'
    );
    readerHelper.writeJsonObjectToFile(
      gameNewspaper,
      outputPath + 'gamenewspaper' + '.json'
    );
  }
};
