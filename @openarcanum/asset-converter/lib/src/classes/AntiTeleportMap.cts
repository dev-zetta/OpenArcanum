// For more information see any >SpellList.mes<

export = class AntiTeleportMap {
  declare recordKey: number;
  declare mapKey: string;
  declare description: string | undefined;

  constructor(recordKey: number, mapKey: string, description?: string) {
    this.recordKey = recordKey;
    this.mapKey = mapKey;
    this.description = description;
  }

};
