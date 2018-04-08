const globalConverter = require('./converters/GlobalConverter');
var patterns = './resources/patterns/';
var arcanumPath = './resources/sourceFiles/';
var output = './resources/out/';

globalConverter.prepareAllPatterns(arcanumPath, patterns);
globalConverter.convertAllFiles(arcanumPath, patterns, output);
