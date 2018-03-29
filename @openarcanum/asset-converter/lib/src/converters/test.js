const globalConverter = require("./GlobalConverter");
var patterns = "../resources/patterns/";
var arcanumPath = "../resources/";
var output = "../resources/";

globalConverter.prepareAllPatterns(arcanumPath, patterns);
globalConverter.convertAllFiles(arcanumPath, patterns, output);
