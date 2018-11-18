// --- RECORD ---
/*
All resources in Arcanum can be represented in a simple pattern later called RECORD:
{
  "key": int,
  "value": string
}
key: this is a number that can be shared between files and in original game is used as identifier
value: is the data

Examples:
{
  "key": 1000,
  "value": "Could you spare a coin?"
}

toString method produces single line easy to read record representation in format:
{"1000": "Could you spare a coin?"}
*/


module.exports = class Record {
  constructor(key, value) {
    this.key = parseInt(key);
    this.value = value;
  }

  toString(){
    return "{\"" +  this.key  + "\": \"" + this.value + "\"}"
  }
};
