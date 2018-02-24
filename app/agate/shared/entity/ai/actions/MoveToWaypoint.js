exports.action = {

  hasWaypoints({ Enums, entity }) {
    if (!entity.npc.waypoints || entity.npc.waypoints.length == 0)
      return -125;

    return 0;
  },

  isMoving({ Enums, entity }) {
    if (entity.base.flags.hasAny([Enums.State.Moving, Enums.State.MovingToWaypoint, Enums.State.PlanningToMove]))
      return -125;

    return 0;
  },



};
