

export default class GameComponent {

  constructor(){

  }

  static get name(){
    return this.constructor.name;
  }

  static get netScheme(){
    return null;
  }
}
