import getGoogleProvider from './Google'
import type {OAuthClient, OAuthTokens} from './Google'
import fs from 'node:fs'
interface AuthOptions { saveTokens?: boolean; scopes?: string[]; video?: Record<string, unknown>; file?: string }
export interface GoogleCredentials {web: {client_id: string; client_secret: string; redirect_uris: string[]}}

const CREDENTIALS_FILENAME = `.google-oauth2-credentials.json`

const TOKEN_DIR =
  (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) +
  `/.credentials/`
const TOKEN_PATH = TOKEN_DIR + `agate-youtube-token.json`



export default class Auth {
  declare _authenticated: boolean
  declare opts: AuthOptions & {saveTokens: boolean; scopes: string[]}
  declare oauth: OAuthClient
  declare tokens: OAuthTokens

  /**
   *
   * @param opts
   */
  constructor(opts: AuthOptions = {}) {
    this._authenticated = false
    this.opts = Object.assign({saveTokens: true, scopes: []}, opts)
  }

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   *
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  async authorize(credentials: GoogleCredentials): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      const web = credentials.web

      let clientSecret = web.client_secret
      let clientId = web.client_id
      let redirectUrl = web.redirect_uris[0]
      this.oauth = getGoogleProvider().createOAuthClient(clientId, clientSecret, redirectUrl)

      // Check if we have previously stored a token.
      fs.readFile(TOKEN_PATH, (err, token) => {
        try {
          if (err) {
            resolve(this.getAuthUrl())
          } else {
            this.setCredentials(JSON.parse(token.toString('utf8')) as OAuthTokens)
            resolve(null)
          }
        } catch (e) {
          resolve(null)
        }
      })
    })
  }

  setCredentials(tokens: OAuthTokens) {
    if (!tokens) {
      throw new Error(`Invalid tokens`)
    }

    this.oauth.setCredentials(tokens)
    this._authenticated = true

    if (this.opts.saveTokens) {
      this.storeToken(tokens)
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

  async getNewToken(code: string): Promise<OAuthClient> {
    return new Promise<OAuthClient>((resolve, reject) => {
      this.oauth.getToken(code, (err, token) => {
        if (err) {
          reject(new Error(`Error while trying to retrieve access token: ${err.message}`))
          return
        }
        if (!token) { reject(new Error('Google returned no token')); return }
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

  storeToken(token: OAuthTokens) {
    try {
      fs.mkdirSync(TOKEN_DIR)
    } catch (err) {
      if (!(err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST')) {
        throw err
      }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
      if (err) throw err
      console.log(`Token stored to ` + TOKEN_PATH)
    })
    console.log(`Token stored to ` + TOKEN_PATH)
  }

  missingAuthentication(_callback?: unknown) {
    console.error(`No auth`)
  }
}
