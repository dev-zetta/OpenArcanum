// For more information see any >SpellList.mes<

module.exports = class Spell {
  constructor(name, records, startAt) {
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

  parseRecordsToSpell(records, startAt) {
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

  parseTargetingRecord(record) {
  }

  addMissile() {
    this.missile = true;
  }

  parseCostRecord(record) {
    const parsedValue = this.convertRecordValueToJson(record);
    this.maintain = parsedValue.Maintain || this.maintain;
    this.cost = parsedValue.Cost || this.cost;
    this.resist = parsedValue.Resist || this.resist;
    this.range = parsedValue.Range || this.range;
    this.info = parsedValue.Info || this.info;
  }

  parseFlagsRecord(record) {
    this.flags.push(record);
  }

  parseAiRecord(record) {
    if (record.value) {
      const parsedValue = this.convertRecordValueToJson(record);
      this.AI_Offensive = parsedValue.AI_Offensive;
      this.AI_Defensive = parsedValue.AI_Defensive;
      this.AI_Summon = parsedValue.AI_Summon;
      this.AI_Flee = parsedValue.AI_Flee;
    }
  }

  convertRecordValueToJson(record) {
    let _temp = record.value.replace(/: /g, '":"');
    _temp = _temp.replace(/, /g, '","');
    return JSON.parse('{"' + _temp + '"}');
  }

  parseEffectRecord(record) {
    this.effects.push(record);
  }
};
