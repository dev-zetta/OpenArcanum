import BasePlayer from '../shared/player/Player';
import Socket from './Socket';

export default class Player extends BasePlayer {

  /**
   * new | synced
   */
  state: string
  socket: Socket

  constructor(socket: Socket) {
    super()
    this.state = 'new'
    this.socket = socket
  }

}
