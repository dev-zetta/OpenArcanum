import Actor from '../../Actor'

export default class NpcActor extends Actor {
  scheme = {
    actions: {
      MoveToWaypoint: {
        priority: 0.5,
        actions: {
          MoveToLocation: {
            actions: {}
          },
          //StopMovement: {}
        }
      },

      AttackNearby: {
        priority: 1.5,
        actions: {
          MoveNearTarget: {
            priority: 1,
            actions: {
              MoveToLocation: {
                actions: {}
              },
              //StopMovement: {}
            }
          },
          AttackTarget: {
            priority: 2,
          }
        }
      }
    }
  }
}
