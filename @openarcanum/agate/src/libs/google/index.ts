import Auth from './Auth'
import YouTube from './YouTube'

const Credentials = {
  web: {
    client_id: process.env.OPENARCANUM_GOOGLE_CLIENT_ID || ``,
    project_id: `openarcanum`,
    auth_uri: `https://accounts.google.com/o/oauth2/auth`,
    token_uri: `https://www.googleapis.com/oauth2/v3/token`,
    auth_provider_x509_cert_url: `https://www.googleapis.com/oauth2/v1/certs`,
    client_secret: process.env.OPENARCANUM_GOOGLE_CLIENT_SECRET || ``,
    redirect_uris: [`http://localhost/oauth`],
    javascript_origins: [`http://localhost`]
  }
}

export default class GoogleApis {
  declare youTube: InstanceType<typeof YouTube>

  constructor() {
    this.youTube = new YouTube()
  }

  getService(serviceName: string): YouTube | undefined {
    let service
    switch (serviceName) {
      case `youtube`: {
        service = this.youTube
        break
      }
    }

    return service
  }

  async getAuthUrl(service: Auth | undefined) {
    if (!service || !Credentials.web.client_id || !Credentials.web.client_secret) {
      return null
    }
    return service.authorize(Credentials)
  }
}
