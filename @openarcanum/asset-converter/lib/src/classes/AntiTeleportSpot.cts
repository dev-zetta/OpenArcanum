// For more information see any >SpellList.mes<

export = class AntiTeleportSpot {
  declare recordKey: number;
  declare x: string;
  declare y: string;
  declare radius: string;
  declare description: string | undefined;

  constructor(recordKey: number, x: string, y: string, radius: string, description?: string) {
    this.recordKey = recordKey;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.description = description;
  }
};
