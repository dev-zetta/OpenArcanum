const dictionaryPatternParser = require("./GeneralDialoguesPatternCreator.js");
const dialogFiles = require('../resources/FilesInformation');
const generalDialogueParser = require("./GeneralDialogueParser");
const readerHelper = require("../helpers/ReaderHelper");

module.exports = {

  prepareAllPatterns : function(arcanumPath, outputPath){
    dictionaryPatternParser.writeParserPatternForFiles(dialogFiles.generalDialogInformation, arcanumPath + "mes/", outputPath, "dialoguePattern");
  },

  convertAllFiles : function(arcanumPath, patternsPath, outputPath){
    var allDialogues = generalDialogueParser.prepareJson(patternsPath + "dialoguePattern.json", arcanumPath + "mes/");
    readerHelper.writeJsonObjectToFile(allDialogues, outputPath + "GeneralDialogue.json");
    generalDialogueParser.prepareJson(patternsPath + "dialoguePattern.json", arcanumPath + "mes/");
  }
};
