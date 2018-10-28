exports.action = {
  isAttacking({ Enums, entity }) {
    if (
      entity.npc.aiState.hasAny([
        Enums.AiState.Attacking,
        Enums.AiState.PreparingToAttack
      ])
    )
      return -125

    return 0
  },

  hasWaypoints({ Enums, entity }) {
    if (!entity.npc.waypoints || entity.npc.waypoints.length == 0) return -125

    return 50
  },

  isMoving({ Enums, entity }) {
    if (
      entity.npc.aiState.hasAny([
        Enums.AiState.Moving,
        Enums.AiState.MovingToWaypoint,
        Enums.AiState.PlanningToMove
      ])
    )
      return -125

    return 0
  }
}
