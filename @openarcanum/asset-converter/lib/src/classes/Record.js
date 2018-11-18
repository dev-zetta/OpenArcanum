// --- RECORD ---
/*
All resources in Arcanum can be represented in a simple pattern later called RECORD:
{
  "key": int,
  "value": string
  "comment": string
}
key: this is a number that can be shared between files and in original game is used as identifier
value: is the data
comment: sometimes creators left comments after record

Examples:
{
  "key": 1000,
  "value": "Could you spare a coin?"
  "comment": "Diry beggar!"
}

toString method produces single line easy to read record representation in format:
{"1000": "Could you spare a coin?"} // Dirty beggar!
*/

module.exports = class Record {
  constructor(key, value, comment) {
    this.key = parseInt(key);
    this.value = value;
    this.comment = comment;
  }

  toString() {
    return (
      '{"' +
      this.key +
      '": "' +
      this.value +
      '"}' +
      (this.comment ? ' // ' + this.comment : '')
    );
  }
};
