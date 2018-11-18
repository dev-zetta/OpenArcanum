const Record = require('./Record');

// --- RECORD RANGE ---
/*
A lot of records can be grouped by ranges with given context
{
  "context": string
  "min": integer,
  "max": integer,
  "records": [ {RECORD}{RECORD}, ... ]
}
identifier:  could be anything: className, raceName, direction or just 'default', it gives context to whole group
min: it is a starting mark for recordId range
max:  it is ending mark for recordId range
records: is initially empty and will be filled in a proper parser with specific language data RECORDs.

Normal file could be filled with records form 1000 to let's say 10000 and we should be aware that it contains
more records that can belong to different categories:
1000 could be a default dialogue option, but 2049 could be race specific, and 2050 could belong to other race etc.

Examples:
{
  "context": "default",
  "min": 1500,
  "max": 1599,
  "records": []
}

{
  "context":"north",
  "min": 700,
  "max": 709,
  "records": []
}

{
  "context":"orc",
  "min": 1550,
  "max": 1599,
  "records": [
    {"1050": "ME EAT NOOOOOW"},
    {"1051": "ME NO HUNGRY"}
  ]
}
*/

module.exports = class RecordRange {
  constructor(min, max, context = "default", records = []) {
    this.min = parseInt(min);
    this.max = parseInt(max);
    this.context = context;
    this.records = [];
    records.forEach((record) => {
        this.records.push(new Record(record.key, record.value))
      }
    )
  }

  addRecordIfInRange(record) {
    if (record.key >= this.min && record.key <= this.max) {
      this.records.push(record);
      return true;
    }
  }
};
