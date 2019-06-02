import Google from './Google'
const OAuth2 = Google.auth.OAuth2

const CREDENTIALS_FILENAME = `.google-oauth2-credentials.json`

const TOKEN_DIR =
  (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) +
  `/.credentials/`
const TOKEN_PATH = TOKEN_DIR + `agate-youtube-token.json`

const fs = require(`fs`)

export default class Auth {
  /**
   *
   * @param opts
   */
  constructor(opts) {
    this._authenticated = false
    this.opts = Object.assign({saveTokens: true}, opts)
  }

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   *
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  async authorize(credentials) {
    return new Promise((resolve, reject) => {
      credentials = credentials.web

      let clientSecret = credentials.client_secret
      let clientId = credentials.client_id
      let redirectUrl = credentials.redirect_uris[0]
      this.oauth = new OAuth2(clientId, clientSecret, redirectUrl)

      // Check if we have previously stored a token.
      fs.readFile(TOKEN_PATH, (err, token) => {
        try {
          if (err) {
            resolve(this.getAuthUrl())
          } else {
            this.setCredentials(JSON.parse(token))
            resolve(null)
          }
        } catch (e) {
          resolve(null)
        }
      })
    })
  }

  setCredentials(tokens) {
    if (!tokens) {
      throw new Error(`Invalid tokens`)
    }

    this.oauth.setCredentials(tokens)
    this._authenticated = true

    if (this.opts.saveTokens) {
      this.storeToken(tokens, this.opts.file)
    }

    this.tokens = tokens
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   *
   * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback to call with the authorized
   *     client.
   */

  async getNewToken(code) {
    return new Promise((resolve, reject) => {
      this.oauth.getToken(code, (err, token) => {
        if (err) {
          reject(`Error while trying to retrieve access token`, err)
          return
        }
        this.setCredentials(token)
        resolve(this.oauth)
      })
    })
  }

  getAuthUrl() {
    return this.oauth.generateAuthUrl({
      access_type: `offline`,
      prompt: `consent`, // access type and approval prompt will force a new refresh token to be made each time signs in
      scope: this.opts.scopes.join(` `)
    })
  }

  storeToken(token) {
    try {
      fs.mkdirSync(TOKEN_DIR)
    } catch (err) {
      if (err.code != `EEXIST`) {
        throw err
      }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
      if (err) throw err
      console.log(`Token stored to ` + TOKEN_PATH)
    })
    console.log(`Token stored to ` + TOKEN_PATH)
  }

  missingAuthentication(e) {
    console.error(`No auth`)
  }
}
