import generalDialoguePatternCreator = require('./patternsCreators/GeneralDialoguesPatternCreator.cjs');
import spellsPatternCreator = require('./parsers/SpellsListParser.cjs');
import newspaperConverter = require('./parsers/GameNewspaperParser.cjs');
import dialogFiles = require('../resources/FilesInformation.cjs');
import generalDialogueParser = require('./parsers/GeneralDialogueParser.cjs');
import antiTeleportParser = require('./parsers/AntiTeleportParser.cjs');
import aiBehavioiurParser = require('./parsers/AIBehaviourParser.cjs');
import readerHelper = require('../helpers/ReaderHelper.cjs');

const generalDialogueFilename = 'generalDialogue.json';
const generalDialoguePatternFilename = 'dialoguePattern.json';

export = {
  prepareAllPatterns: function (arcanumPath: string, outputPath: string) {
    generalDialoguePatternCreator.writeParserPatternForFiles(
      dialogFiles.generalDialogInformation,
      arcanumPath + 'Arcanum3/mes/',
      outputPath,
      generalDialoguePatternFilename
    );
  },

  convertAllFiles: function (arcanumPath: string, patternsPath: string, outputPath: string) {
    const generalDialogues = generalDialogueParser.prepareJson(patternsPath + generalDialoguePatternFilename, arcanumPath + 'Arcanum3/mes/');
    readerHelper.writeJsonObjectToFile(generalDialogues, outputPath + generalDialogueFilename);

    const spells = spellsPatternCreator.parseSpells('SpellList', arcanumPath + 'Arcanum4/Rules/');
    readerHelper.writeJsonObjectToFile(spells, outputPath + 'SpellList.json');

    const gameNewspaper = newspaperConverter.prepareGameNewspapers('gamenewspaper', arcanumPath + 'modules/Arcanum/mes/');
    readerHelper.writeJsonObjectToFile(gameNewspaper, outputPath + 'gamenewspaper.json');

    const antiTeleportation = antiTeleportParser.prepareAntiTeleports('AntiTeleport', arcanumPath + "modules/Arcanum/Rules/");
    readerHelper.writeJsonObjectToFile(antiTeleportation, outputPath + 'AntiTeleport.json');

    const AIBehaviours = aiBehavioiurParser.parseAI('ai_params', arcanumPath + "Arcanum3/rules/");
    readerHelper.writeJsonObjectToFile(AIBehaviours, outputPath + 'ai_params.json');
  }
};
