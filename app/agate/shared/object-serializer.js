// https://github.com/evanw/kiwi

/* global requireNode */
var kiwi = require('kiwi-schema');
var fs = require('fs');
var schema = kiwi.compileSchema(fs.readFileSync('test.kiwi', 'utf8'));

var buffer = schema.encodeTest({x: 123});
var test = schema.decodeTest(buffer);

if (test.x !== undefined) {
  console.log('x is', test.x);
}
