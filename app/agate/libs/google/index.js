import {GoogleAuth} from './auth'
import YouTube from './youtube'

const Credentials = {
  web: {
    client_id: `919453027116-snepln6mj9083toh4fc9ig5dgs3ln2ji.apps.googleusercontent.com`,
    project_id: `openarcanum`,
    auth_uri: `https://accounts.google.com/o/oauth2/auth`,
    token_uri: `https://www.googleapis.com/oauth2/v3/token`,
    auth_provider_x509_cert_url: `https://www.googleapis.com/oauth2/v1/certs`,
    client_secret: `REMOVED_OLD_OAUTH_CLIENT_SECRET`,
    redirect_uris: [`http://localhost/oauth`],
    javascript_origins: [`http://localhost`]
  }
}

export default class GoogleApis {
  static GoogleAuth
  static YouTube

  constructor() {
    this.youTube = new YouTube()
  }

  getService(serviceName) {
    let service
    switch (serviceName) {
      case 'youtube': {
        service = this.youTube
        break
      }
    }

    return service
  }

  async getAuthUrl(service) {
    if (!service) {
      return null
    }
    return service.authorize(Credentials)
  }


}
