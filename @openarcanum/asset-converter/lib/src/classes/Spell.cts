// For more information see any >SpellList.mes<

export = class Spell {
  declare name: string;
  declare castingEffect: string;
  declare maintain: boolean | string;
  declare resist: boolean | string;
  declare range: string;
  declare minIq: number;
  declare info: string;
  declare cost: number | string;
  declare flags: import("./Record.cjs")[];
  declare effects: import("./Record.cjs")[];
  declare missile: boolean | undefined;
  declare AI_Offensive: string | undefined;
  declare AI_Defensive: string | undefined;
  declare AI_Summon: string | undefined;
  declare AI_Flee: string | undefined;

  constructor(name: string, records: import("./Record.cjs")[], startAt: number) {
    this.name = name;
    this.castingEffect = 'Instant';
    this.maintain = false;
    this.resist = false;
    this.range = 'MaxVisible';
    this.minIq = 6;
    this.info = 'Neutral';
    this.cost = 0;
    this.flags = [];

    this.effects = [];

    this.parseRecordsToSpell(records, startAt);
  }

  parseRecordsToSpell(records: import("./Record.cjs")[], startAt: number) {
    for (let i = 0; i < records.length; ++i) {
      const _record = records[i];
      switch (_record.key - startAt) {
        case 0:
          this.parseTargetingRecord(_record);
          break;
        case 1:
          this.parseCostRecord(_record);
          break;
        case 2:
          this.addMissile();
          break;
        case 3:
          this.parseFlagsRecord(_record);
          break;
        case 4:
          this.parseAiRecord(_record);
          break;
        default:
          this.parseEffectRecord(_record);
          break;
      }
    }
  }

  parseTargetingRecord(record: import("./Record.cjs")) {
  }

  addMissile() {
    this.missile = true;
  }

  parseCostRecord(record: import("./Record.cjs")) {
    const parsedValue = this.convertRecordValueToJson(record);
    this.maintain = parsedValue.Maintain || this.maintain;
    this.cost = parsedValue.Cost || this.cost;
    this.resist = parsedValue.Resist || this.resist;
    this.range = parsedValue.Range || this.range;
    this.info = parsedValue.Info || this.info;
  }

  parseFlagsRecord(record: import("./Record.cjs")) {
    this.flags.push(record);
  }

  parseAiRecord(record: import("./Record.cjs")) {
    if (record.value) {
      const parsedValue = this.convertRecordValueToJson(record);
      this.AI_Offensive = parsedValue.AI_Offensive;
      this.AI_Defensive = parsedValue.AI_Defensive;
      this.AI_Summon = parsedValue.AI_Summon;
      this.AI_Flee = parsedValue.AI_Flee;
    }
  }

  convertRecordValueToJson(record: import("./Record.cjs")): { [field: string]: string | undefined } {
    let _temp = record.value.replace(/: /g, '":"');
    _temp = _temp.replace(/, /g, '","');
    return JSON.parse('{"' + _temp + '"}');
  }

  parseEffectRecord(record: import("./Record.cjs")) {
    this.effects.push(record);
  }
};
