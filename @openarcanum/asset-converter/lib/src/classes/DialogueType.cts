import RecordRange = require('./RecordRange.cjs');

// --- DIALOGUE TYPE ---
/*
Dialogues can be mostly represented by this structure:
{
  "type": string,
  "description": string,
  "recordRanges": [
    {RECORD RANGE},
    {RECORD RANGE},
    {RECORD RANGE}
  ]

}
type: it's type of dialogue that we're dealing with
description: it's description that describes dialogue
recordRanges: contains lists for different ranges and with different context

It should be mentioned that variables classes, races, directions, default can be empty. This simply means that that this dialogue does not contain any records in that specific context;

Examples:
{
  "type": "khajjitIsInnocentOfThisCrime",
  "description": "the NPC is refusing to buy stolen goods",
  "recordRanges": [
    {
      "context": "default" //default context
      "min": 4600,
      "max": 4699,
      "records": []
    },
    {
      "context": "human" // race context
      "min": 4700,
      "max": 4799,
      "records": []
    },
    {
      "context": "mage" // class context etc...
      "min": 4800,
      "max": 4899,
      "records": []
    },
  ]
}
*/

export = class DialogueType {
  declare type: string | undefined;
  declare description: string;
  declare recordRanges: RecordRange[];

  constructor(type: string | undefined, description: string, recordRanges: {min: string | number; max: string | number; context?: string; records?: {key: number; value: string}[]}[] = []) {
    this.type = type;
    this.description = description;
    this.recordRanges = [];
    recordRanges.forEach((recordRange) => {
      this.recordRanges.push(new RecordRange(recordRange.min, recordRange.max, recordRange.context, recordRange.records));
    })
  }

  addRecord(record: import("./Record.cjs")) {
    for (let i = 0; i < this.recordRanges.length; ++i) {
      if (this.recordRanges[i].addRecordIfInRange(record)) {
        return true;
      }
    }
  }

  addRange(obj: RecordRange) {
    this.recordRanges.push(obj);
  };

}
;
