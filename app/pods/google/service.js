import Service from '@ember/service';

import GoogleApis from '../../agate/libs/google'

export default class GoogleService extends Service {
  constructor() {
    super(...arguments)
    this.api = new GoogleApis()
  }

}
