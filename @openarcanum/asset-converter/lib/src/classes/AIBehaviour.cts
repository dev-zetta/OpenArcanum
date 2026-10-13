// For more information see any >ai_params.mes<

// ---- the first five are fleeing params
//	D1:  percentage of NPC hit points below which NPC will flee
//	D2:  number of people besides PC beyond which NPC will flee
//	D3:  number of levels above NPC beyond which NPC will flee
//	D4:  percentage of PC hit points below which NPC will never flee
//	D5:  how far to flee, in tiles
// ---- the next five are follow params
//	D6:  the reaction level at which the NPC will not follow the PC
//	D7:  how far PC align is above NPC align before NPC wont follow
//	D8:  how far PC align is below NPC align before NPC wont follow
//	D9:  how many levels the NPC can be above the PC and still join
//	D10: how much a non-accidental hit will lower a follower's reaction
// ---- the next two are kill-on-sight (KOS) params
//	D11: NPC will attack if his reaction is below this
//	D12: how different alignments can be before non-follower NPC attacks
//	D13: alignment of target at (or above) which the good-aligned follower NPC will not attack
// ---- the next params control spell use
//	D14: chance of throwing defensive spell (as opposed to offensive)
//	D15: chance of throwing a healing spell in combat
// ---- the next params control combat
//	D16: minimum distance in combat
// ---- the next params control door and window usage
//	D17: the NPC can open portals if this is nonzero and cannot if it is zero

// alternative constructor
/*

this.flee = {
  whenHealthBelowPercent: stats[0],
  whenSurroundedBy: stats[1],
  whenEnemyIsStrongerByLevels: stats[2],
  dontFleeWhenEnemyHealthBelowPercent: stats[3],
  fleeDistance: stats[4],
};
this.follow = {
  whenHeroReactionBelow: stats[5],
  whenHeroAlignmentAbove: stats[6],
  whenHeroAlignmentBelow: stats[7],
  whenHeroLevelBelowNPCNotMoreThan: stats[8],
  nonAccidentalHitTolerated: stats[9]
};
this.killOnSight = {
  whenHeroReactionBelow: stats[10],
  whenAlignmentDifferenceNotMoreThan: stats[11],
  alignmentLevelAboveWhichGoodAlignedFollowersWillNotAttack: stats[12]
};
this.spellUse = {
  chanceOfCastingDefensiveSpell: stats[13],
  chanceOfCastingHealingSpellInCombat: [14]
};
this.minimumDistanceInCombat = stats[15];
this.canOpenDoors = !!stats[16];
this.description = stats[17];
*/

export = class AIBehaviour {
  declare recordKey: string | number | undefined;
  declare fleeWhenHealthBelowPercent: string | number | undefined;
  declare fleeWhenSurroundedBy: string | number | undefined;
  declare fleeWhenEnemyIsStrongerByLevels: string | number | undefined;
  declare dontFleeWhenEnemyHealthBelowPercent: string | number | undefined;
  declare fleeDistance: string | number | undefined;
  declare followWhenHeroReactionBelow: string | number | undefined;
  declare followWhenHeroAlignmentAbove: string | number | undefined;
  declare followWhenHeroAlignmentBelow: string | number | undefined;
  declare followWhenHeroLevelBelowNPCNotMoreThan: string | number | undefined;
  declare nonAccidentalHitTolerated: string | number | undefined;
  declare killOnSightWhenHeroReactionBelow: string | number | undefined;
  declare killOnSightWhenAlignmentDifferenceNotMoreThan: string | number | undefined;
  declare killOnSightWhenAlignmentLevelAboveWhichGoodAlignedFollowersWillNotAttack: string | number | undefined;
  declare chanceOfCastingDefensiveSpell: string | number | undefined;
  declare chanceOfCastingHealingSpellInCombat: string | number | undefined;
  declare minimumDistanceInCombat: string | number | undefined;
  declare canOpenDoors: boolean;
  declare description: string | number | undefined;

  constructor(stats: (string | number | undefined)[]) {
    this.recordKey = stats[18];

    this.fleeWhenHealthBelowPercent = stats[0];
    this.fleeWhenSurroundedBy = stats[1];
    this.fleeWhenEnemyIsStrongerByLevels = stats[2];
    this.dontFleeWhenEnemyHealthBelowPercent = stats[3];
    this.fleeDistance = stats[4];

    this.followWhenHeroReactionBelow = stats[5];
    this.followWhenHeroAlignmentAbove = stats[6];
    this.followWhenHeroAlignmentBelow = stats[7];
    this.followWhenHeroLevelBelowNPCNotMoreThan = stats[8];
    this.nonAccidentalHitTolerated = stats[9];

    this.killOnSightWhenHeroReactionBelow = stats[10];
    this.killOnSightWhenAlignmentDifferenceNotMoreThan = stats[11];
    this.killOnSightWhenAlignmentLevelAboveWhichGoodAlignedFollowersWillNotAttack = stats[12];

    this.chanceOfCastingDefensiveSpell = stats[13];
    this.chanceOfCastingHealingSpellInCombat = stats[14];

    this.minimumDistanceInCombat = stats[15];
    this.canOpenDoors = !!stats[16];
    this.description = stats[17];
  }
};
