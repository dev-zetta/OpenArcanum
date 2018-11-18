const globalConverter = require('./converters/GlobalConverter');
const patterns = './resources/patterns/';
const arcanumPath = './resources/sourceFiles/';
const output = './resources/out/';

// Use only to Recreate Patterns
// globalConverter.prepareAllPatterns(arcanumPath, patterns);

globalConverter.convertAllFiles(arcanumPath, patterns, output);
