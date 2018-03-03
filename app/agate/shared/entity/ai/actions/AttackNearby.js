exports.action = {
  isAlreadyAttacking({ Enums, entity }) {
    if (entity.npc.aiState.hasAny([Enums.AiState.Attacking, Enums.AiState.PreparingToAttack]))
      return -125;

    return 0;
  },

  hasAnyoneInRange({ Enums, entity }) {
    let nearby = entity.nearbyEntities;
    if (!nearby || nearby.length == 0)
      return -125;

    return 50;
  },



};
