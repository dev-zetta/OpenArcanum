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
    for (var i = 0; i < records.length; ++i) {
      var _record = records[i];
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
    var _temp = record.value.replace(/: /g, '":"');
    _temp = _temp.replace(/, /g, '","');
    var parsedInfo = JSON.parse('{"' + _temp + '"}');
    this.maintain = parsedInfo.Maintain || this.maintain;
    this.cost = parsedInfo.Cost || this.cost;
    this.resist = parsedInfo.Resist || this.resist;
    this.range = parsedInfo.Range || this.range;
    this.info = parsedInfo.Info || this.info;
  }

  parseFlagsRecord(record) {
    this.flags.push(record);
  }

  parseAiRecord(record) {
    var _temp = record.value.replace(/: /g, '":"');
    _temp = _temp.replace(/, /g, '","');
    if (record.value) {
      var parsedInfo = JSON.parse('{"' + _temp + '"}');
      this.AI_Offensive = parsedInfo.AI_Offensive;
      this.AI_Defensive = parsedInfo.AI_Defensive;
      this.AI_Summon = parsedInfo.AI_Summon;
      this.AI_Flee = parsedInfo.AI_Flee;
    }
  }

  parseEffectRecord(record) {
    this.effects.push(record);
  }
};
