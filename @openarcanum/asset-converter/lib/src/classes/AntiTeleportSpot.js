// For more information see any >SpellList.mes<

module.exports = class AntiTeleportSpot {
  constructor(recordKey, mapKey, x, y, radius, description) {
    this.recordKey = recordKey;
    this.mapKey = mapKey;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.description = description;
  }

};
