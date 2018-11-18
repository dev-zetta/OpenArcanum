const globalConverter = require('./converters/GlobalConverter');

const path = require('path');

let _patterns = '../../converted/';
let _arcanumPath = '../../sourceFiles/';
let _outputPath = '../../converted/';

/* Var path = require('path')
console.log(path.resolve(_outputPath)) */

class Executor {
  static start(arcanumPath, outputPath, patterns) {
    arcanumPath = `${path.resolve(arcanumPath || _arcanumPath)}/`;
    outputPath = `${path.resolve(outputPath || _outputPath)}/`;
    patterns = `${path.resolve(patterns || _patterns)}/`;

    globalConverter.prepareAllPatterns(arcanumPath, patterns);
    globalConverter.convertAllFiles(arcanumPath, patterns, outputPath);
  }
}

module.exports = Executor;
