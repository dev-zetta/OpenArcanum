const globalConverter = require('./converters/GlobalConverter');

let patterns = './converted/';
let _arcanumPath = './sourceFiles/';
let _outputPath = './converted/';

/* Var path = require('path')
console.log(path.resolve(_outputPath)) */

class Executor {
  static start(arcanumPath, outputPath) {
    globalConverter.prepareAllPatterns(arcanumPath || _arcanumPath, patterns);
    globalConverter.convertAllFiles(
      arcanumPath || _arcanumPath,
      patterns,
      outputPath || _outputPath
    );
  }
}

module.exports = Executor;
