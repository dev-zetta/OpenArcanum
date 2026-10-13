import BasePlayer from '../shared/player/Player'
import type {Socket} from 'socket.io'
export default class Player extends BasePlayer {
  declare state: 'new' | 'synced'
  declare socket: Socket
  declare id: string
  declare worldId: string | undefined
  constructor(socket: Socket) {
    super()
    this.state = 'new'
    this.socket = socket
    this.id = socket.id
  }
}
